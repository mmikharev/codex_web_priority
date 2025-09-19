import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './App.module.css';
import { AddTaskButton } from './components/AddTaskButton';
import { BacklogList } from './components/BacklogList';
import { ImportPanel } from './components/ImportPanel';
import { ManualTaskForm } from './components/ManualTaskForm';
import { Modal } from './components/Modal';
import { PomodoroBar } from './components/PomodoroBar';
import { PriorityOverview } from './components/PriorityOverview';
import { QuadrantBoard } from './components/QuadrantBoard';
import { SearchBar } from './components/SearchBar';
import { TaskCard } from './components/TaskCard';
import { ThemeToggleButton } from './components/ThemeToggleButton';
import { usePomodoroTimer } from './hooks/usePomodoroTimer';
import { useTaskStore } from './hooks/useTaskStore';
import { useThemePreference } from './hooks/useThemePreference';
import { Quadrant, Task } from './types';
import { createExportPayload } from './utils/export';
import { createMarkdown, createPrintableHtml } from './utils/exportFormats';
import { sortTasks } from './utils/taskSort';

type QuadrantId = Exclude<Quadrant, 'backlog'>;

type CollapseState = {
  backlog: boolean;
  quadrants: Record<QuadrantId, boolean>;
};

const COLLAPSE_STORAGE_KEY = 'eisenhower_ui_prefs_v1';

const DEFAULT_COLLAPSE_STATE: CollapseState = {
  backlog: false,
  quadrants: {
    Q1: false,
    Q2: false,
    Q3: false,
    Q4: false,
  },
};

function filterBacklog(tasks: Task[], query: string, hideCompleted: boolean): Task[] {
  const normalized = query.trim().toLowerCase();

  return sortTasks(
    tasks.filter((task) => {
      if (hideCompleted && task.done) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      const haystack = `${task.title} ${task.due ?? ''}`.toLowerCase();
      return haystack.includes(normalized);
    }),
  );
}

export default function App() {
  const {
    tasks,
    quadrants,
    importTasks,
    moveTask,
    updateTask,
    resetTask,
    addTask,
    clearCorruptedState,
    loadError,
  } = useTaskStore();

  const { theme, toggleTheme } = useThemePreference();
  const pomodoro = usePomodoroTimer();

  const [importText, setImportText] = useState('');
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [manualFormQuadrant, setManualFormQuadrant] = useState<Quadrant>('backlog');
  const [manualFormFocusToken, setManualFormFocusToken] = useState(0);
  const [isTaskModalOpen, setTaskModalOpen] = useState(false);
  const [focusModeEnabled, setFocusModeEnabled] = useState(false);

  const [collapseState, setCollapseState] = useState<CollapseState>(() => ({
    backlog: DEFAULT_COLLAPSE_STATE.backlog,
    quadrants: { ...DEFAULT_COLLAPSE_STATE.quadrants },
  }));
  const [collapseLoaded, setCollapseLoaded] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const importTextareaRef = useRef<HTMLTextAreaElement>(null);
  const manualFormRef = useRef<HTMLFormElement>(null);

  const backlogTasks = quadrants.backlog ?? [];
  const filteredBacklog = useMemo(
    () => filterBacklog(backlogTasks, searchQuery, hideCompleted),
    [backlogTasks, hideCompleted, searchQuery],
  );

  const allTasks = useMemo(() => Object.values(tasks), [tasks]);
  const activeTask = useMemo(() => (pomodoro.activeTaskId ? tasks[pomodoro.activeTaskId] ?? null : null), [pomodoro.activeTaskId, tasks]);

  const pomodoroControls = useMemo(
    () => ({
      activeTaskId: pomodoro.activeTaskId,
      mode: pomodoro.mode,
      runState: pomodoro.runState,
      remainingSeconds: pomodoro.remainingSeconds,
      stats: pomodoro.stats.completedPerTask,
      onStart: pomodoro.start,
      onPause: pomodoro.pause,
      onResume: pomodoro.resume,
      onReset: pomodoro.reset,
    }),
    [pomodoro.activeTaskId, pomodoro.mode, pomodoro.runState, pomodoro.remainingSeconds, pomodoro.stats.completedPerTask, pomodoro.start, pomodoro.pause, pomodoro.resume, pomodoro.reset],
  );

  const handleImport = useCallback(
    (jsonText: string, options: { resetQuadrants: boolean }) => {
      setImportError(null);
      try {
        const summary = importTasks(jsonText, options);
        setImportFeedback(
          summary.total === 0
            ? 'Импорт завершён: новых задач нет'
            : `Импорт завершён: ${summary.added} новых, ${summary.updated} обновлено`,
        );
        setImportText('');
      } catch (error) {
        setImportFeedback(null);
        setImportError(error instanceof Error ? error.message : String(error));
      }
    },
    [importTasks],
  );

  const handleBacklogDrop = useCallback(
    (taskId: string) => {
      moveTask(taskId, 'backlog');
    },
    [moveTask],
  );

  const handleQuadrantDrop = useCallback(
    (taskId: string, quadrant: QuadrantId) => {
      moveTask(taskId, quadrant);
    },
    [moveTask],
  );

  const handleUpdateTask = useCallback(
    (taskId: string, updates: { title?: string; due?: string | null; done?: boolean }) => {
      updateTask(taskId, updates);
    },
    [updateTask],
  );

  const handleCreateTask = useCallback(
    (payload: { title: string; due: string | null; quadrant: Quadrant }) => {
      addTask(payload);
    },
    [addTask],
  );

  const handleExportJson = useCallback(() => {
    const exportPayload = createExportPayload(tasks);
    const json = JSON.stringify(exportPayload, null, 2);

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const now = new Date();
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    link.href = url;
    link.download = `eisenhower-export-${datePart}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setImportFeedback('JSON экспортирован в файл');
  }, [tasks]);

  const handleExportMarkdown = useCallback(() => {
    const markdown = createMarkdown(allTasks);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tasks.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [allTasks]);

  const handleExportPdf = useCallback(() => {
    const html = createPrintableHtml(allTasks);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
  }, [allTasks]);

  const handleClearFilter = useCallback(() => {
    setSearchQuery('');
    setSearchExpanded(false);
  }, []);

  const handleHideCompletedChange = useCallback((value: boolean) => {
    setHideCompleted(value);
  }, []);

  const handleQuadrantCreateRequest = useCallback(
    (quadrant: QuadrantId) => {
      setManualFormQuadrant(quadrant);
      setManualFormFocusToken((token) => token + 1);
      setTaskModalOpen(true);
    },
    [],
  );

  const handleToggleBacklogCollapse = useCallback(() => {
    setCollapseState((previous) => ({
      backlog: !previous.backlog,
      quadrants: { ...previous.quadrants },
    }));
  }, []);

  const handleToggleQuadrantCollapse = useCallback((quadrant: QuadrantId) => {
    setCollapseState((previous) => ({
      backlog: previous.backlog,
      quadrants: { ...previous.quadrants, [quadrant]: !previous.quadrants[quadrant] },
    }));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setCollapseLoaded(true);
      return;
    }

    try {
      const raw = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CollapseState> | null;
        const nextQuadrants: Record<QuadrantId, boolean> = { ...DEFAULT_COLLAPSE_STATE.quadrants };

        if (parsed?.quadrants && typeof parsed.quadrants === 'object') {
          (Object.keys(nextQuadrants) as QuadrantId[]).forEach((quadrantId) => {
            const value = (parsed.quadrants as Record<string, unknown>)[quadrantId];
            if (typeof value === 'boolean') nextQuadrants[quadrantId] = value;
          });
        }

        setCollapseState({
          backlog: typeof parsed?.backlog === 'boolean' ? parsed.backlog : DEFAULT_COLLAPSE_STATE.backlog,
          quadrants: nextQuadrants,
        });
      }
    } catch (error) {
      console.warn('Failed to load collapse state', error);
    } finally {
      setCollapseLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!collapseLoaded || typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(collapseState));
    } catch (error) {
      console.warn('Failed to save collapse state', error);
    }
  }, [collapseLoaded, collapseState]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      const normalizedKey = key.toLowerCase();
      const target = event.target as HTMLElement | null;
      const isEditableTarget =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (event.metaKey || event.ctrlKey || event.altKey) {
        if (normalizedKey === 'escape' && searchQuery) {
          event.preventDefault();
          setSearchQuery('');
          setSearchExpanded(false);
        }
        return;
      }

      if (normalizedKey === '/') {
        event.preventDefault();
        setSearchExpanded(true);
        window.requestAnimationFrame(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        });
        return;
      }

      if (normalizedKey === 'p') {
        if (isEditableTarget) {
          return;
        }
        event.preventDefault();
        if (pomodoro.runState === 'running') {
          pomodoro.pause();
        } else if (pomodoro.activeTaskId) {
          pomodoro.resume();
        }
        return;
      }

      if (normalizedKey === 'r') {
        if (isEditableTarget) {
          return;
        }
        event.preventDefault();
        pomodoro.reset();
        setFocusModeEnabled(false);
        return;
      }

      if (normalizedKey === 'escape') {
        if (searchQuery) {
          event.preventDefault();
          setSearchQuery('');
          setSearchExpanded(false);
        }
        return;
      }

      if (isEditableTarget) {
        return;
      }

      if (normalizedKey === 'i') {
        event.preventDefault();
        importTextareaRef.current?.focus();
        importTextareaRef.current?.select?.();
        return;
      }

      if (['0', '1', '2', '3', '4'].includes(key)) {
        const activeElement = document.activeElement as HTMLElement | null;
        const taskId = activeElement?.dataset.taskId;
        if (!taskId) {
          return;
        }

        const targetQuadrant: Quadrant =
          key === '0'
            ? 'backlog'
            : key === '1'
            ? 'Q1'
            : key === '2'
            ? 'Q2'
            : key === '3'
            ? 'Q3'
            : 'Q4';

        event.preventDefault();
        moveTask(taskId, targetQuadrant);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [moveTask, searchQuery, pomodoro]);

  useEffect(() => {
    if (!importText) {
      return;
    }
    setImportFeedback(null);
    setImportError(null);
  }, [importText]);

  useEffect(() => {
    if (pomodoro.runState === 'stopped') {
      setFocusModeEnabled(false);
    }
  }, [pomodoro.runState]);

  const handleSelectQuadrant = useCallback((quadrant: Quadrant) => {
    const dropArea = document.getElementById(`quadrant-${quadrant}`);
    dropArea?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const handleToggleFocusMode = useCallback(() => {
    if (!pomodoro.activeTaskId) {
      return;
    }
    setFocusModeEnabled((value) => !value);
  }, [pomodoro.activeTaskId]);

  return (
    <div className={styles.app}>
      {loadError ? (
        <div className={styles.alert}>
          <div>Не удалось загрузить сохранённое состояние: {loadError.message}</div>
          <button type="button" onClick={clearCorruptedState}>
            Сбросить состояние
          </button>
        </div>
      ) : null}

      <header className={styles.hero}>
        <PriorityOverview quadrants={quadrants} onSelect={handleSelectQuadrant} />
        <div className={styles.actionRow}>
          <SearchBar
            value={searchQuery}
            expanded={searchExpanded || !!searchQuery}
            onChange={setSearchQuery}
            onClear={handleClearFilter}
            onToggle={setSearchExpanded}
            inputRef={searchInputRef}
          />
          <div className={styles.topControls}>
            <AddTaskButton
              onClick={() => {
                setTaskModalOpen(true);
                setManualFormFocusToken((token) => token + 1);
              }}
            />
            <ThemeToggleButton theme={theme} onToggle={toggleTheme} />
          </div>
        </div>
      </header>

      <PomodoroBar
        activeTask={activeTask ?? null}
        mode={pomodoro.mode}
        runState={pomodoro.runState}
        remainingSeconds={pomodoro.remainingSeconds}
        config={pomodoro.config}
        stats={pomodoro.stats}
        focusModeEnabled={focusModeEnabled}
        onPause={pomodoro.pause}
        onResume={pomodoro.resume}
        onReset={pomodoro.reset}
        onSkip={pomodoro.skip}
        onToggleFocusMode={handleToggleFocusMode}
        onUpdateConfig={pomodoro.updateConfig}
        onClearStats={pomodoro.clearStats}
      />

      {focusModeEnabled && activeTask ? (
        <div className={styles.focusOverlay}>
          <h2 className={styles.focusOverlayTitle}>Фокус на задаче</h2>
          <TaskCard
            task={activeTask}
            onUpdate={handleUpdateTask}
            onReset={activeTask.quadrant === 'backlog' ? undefined : resetTask}
            pomodoro={{
              activeTaskId: pomodoro.activeTaskId,
              mode: pomodoro.mode,
              runState: pomodoro.runState,
              remainingSeconds: pomodoro.remainingSeconds,
              completedCount: pomodoro.stats.completedPerTask[activeTask.id] ?? 0,
              onStart: pomodoro.start,
              onPause: pomodoro.pause,
              onResume: pomodoro.resume,
              onReset: pomodoro.reset,
            }}
          />
        </div>
      ) : (
        <>
          <div className={styles.layoutGrid}>
            <ImportPanel
              value={importText}
              onChange={setImportText}
              onImport={handleImport}
              onExportJson={handleExportJson}
              onExportMarkdown={handleExportMarkdown}
              onExportPdf={handleExportPdf}
              feedback={importFeedback}
              error={importError}
              textareaRef={importTextareaRef}
            />
            <div>
              <BacklogList
                tasks={filteredBacklog}
                totalCount={backlogTasks.length}
                hideCompleted={hideCompleted}
                onHideCompletedChange={handleHideCompletedChange}
                onDropTask={handleBacklogDrop}
                onUpdateTask={handleUpdateTask}
                collapsed={collapseState.backlog}
                onToggleCollapse={handleToggleBacklogCollapse}
                pomodoroControls={pomodoroControls}
              />
              <p className={styles.hotkeysHint}>
                Горячие клавиши: / — поиск, i — импорт, Esc — очистить поиск, 0–4 — перемещение задач, P — старт/пауза, R —
                сброс таймера
              </p>
            </div>
          </div>

          <div className={styles.boardRow}>
            <QuadrantBoard
              quadrants={{ Q1: quadrants.Q1 ?? [], Q2: quadrants.Q2 ?? [], Q3: quadrants.Q3 ?? [], Q4: quadrants.Q4 ?? [] }}
              collapsed={collapseState.quadrants}
              onDropTask={handleQuadrantDrop}
              onUpdateTask={handleUpdateTask}
              onResetTask={resetTask}
              onToggleCollapse={handleToggleQuadrantCollapse}
              onRequestCreateTask={handleQuadrantCreateRequest}
              pomodoroControls={pomodoroControls}
            />
          </div>
        </>
      )}

      <Modal open={isTaskModalOpen} onClose={() => setTaskModalOpen(false)} title="Быстрое добавление">
        <ManualTaskForm
          ref={manualFormRef}
          onCreateTask={handleCreateTask}
          initialQuadrant={manualFormQuadrant}
          focusTrigger={manualFormFocusToken}
        />
      </Modal>
    </div>
  );
}
