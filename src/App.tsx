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
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
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

function isCompletedToday(completedAt?: string | null): boolean {
  if (!completedAt) {
    return false;
  }
  const completedDate = new Date(completedAt);
  if (Number.isNaN(completedDate.getTime())) {
    return false;
  }
  const now = new Date();
  return (
    completedDate.getFullYear() === now.getFullYear() &&
    completedDate.getMonth() === now.getMonth() &&
    completedDate.getDate() === now.getDate()
  );
}

function filterTasks(
  tasks: Task[],
  query: string,
  options: { hideCompletedToday: boolean; hideCompletedAll: boolean },
): Task[] {
  const normalized = query.trim().toLowerCase();

  return sortTasks(
    tasks.filter((task) => {
      const done = task.done ?? false;
      if (done) {
        if (options.hideCompletedAll) {
          return false;
        }
        if (options.hideCompletedToday && isCompletedToday(task.completedAt)) {
          return false;
        }
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
    deleteTask,
    addTimeToTask,
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
  const [hideCompletedToday, setHideCompletedToday] = useState(false);
  const [hideCompletedAll, setHideCompletedAll] = useState(false);
  const [manualFormQuadrant, setManualFormQuadrant] = useState<Quadrant>('backlog');
  const [manualFormFocusToken, setManualFormFocusToken] = useState(0);
  const [isTaskModalOpen, setTaskModalOpen] = useState(false);
  const [focusModeEnabled, setFocusModeEnabled] = useState(false);
  const [taskModalTab, setTaskModalTab] = useState<'quick' | 'import'>('quick');

  const [collapseState, setCollapseState] = useState<CollapseState>(() => ({
    backlog: DEFAULT_COLLAPSE_STATE.backlog,
    quadrants: { ...DEFAULT_COLLAPSE_STATE.quadrants },
  }));
  const [collapseLoaded, setCollapseLoaded] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const importTextareaRef = useRef<HTMLTextAreaElement>(null);
  const manualFormRef = useRef<HTMLFormElement>(null);
  const modalFocusHandledRef = useRef<'quick' | 'import' | null>(null);
  const processedPomodoroSessionsRef = useRef(0);

  const backlogTasks = quadrants.backlog ?? [];
  const allTasks = useMemo(() => Object.values(tasks), [tasks]);
  const hideOptions = useMemo(
    () => ({ hideCompletedToday, hideCompletedAll }),
    [hideCompletedAll, hideCompletedToday],
  );
  const backlogDisplayTasks = useMemo(() => {
    const source = searchQuery.trim() ? allTasks : backlogTasks;
    return filterTasks(source, searchQuery, hideOptions);
  }, [allTasks, backlogTasks, hideOptions, searchQuery]);
  const backlogTotalCount = useMemo(() => {
    if (searchQuery.trim()) {
      return backlogDisplayTasks.length;
    }
    return backlogTasks.length;
  }, [backlogDisplayTasks, backlogTasks, searchQuery]);
  const visibleQuadrants = useMemo(() => {
    const map: Record<Quadrant, Task[]> = { backlog: [], Q1: [], Q2: [], Q3: [], Q4: [] };
    (Object.keys(map) as Quadrant[]).forEach((quadrant) => {
      const list = quadrants[quadrant] ?? [];
      map[quadrant] = filterTasks(list, searchQuery, hideOptions);
    });
    return map;
  }, [quadrants, hideOptions, searchQuery]);
  const activeTask = useMemo(
    () => (pomodoro.activeTaskId ? tasks[pomodoro.activeTaskId] ?? null : null),
    [pomodoro.activeTaskId, tasks],
  );
  const backlogSubtitle = useMemo(() => {
    if (searchQuery.trim()) {
      return undefined;
    }
    if (hideCompletedAll) {
      return 'Скрыты выполненные задачи';
    }
    if (hideCompletedToday) {
      return 'Скрыты выполненные сегодня';
    }
    return undefined;
  }, [hideCompletedAll, hideCompletedToday, searchQuery]);

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

  const handleDeleteTask = useCallback(
    (taskId: string) => {
      if (pomodoro.activeTaskId === taskId) {
        pomodoro.reset();
        setFocusModeEnabled(false);
      }
      deleteTask(taskId);
    },
    [deleteTask, pomodoro.activeTaskId, pomodoro.reset],
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

  const handleHideCompletedTodayChange = useCallback((value: boolean) => {
    setHideCompletedToday(value);
    if (!value) {
      setHideCompletedAll(false);
    }
  }, []);

  const handleHideCompletedAllChange = useCallback((value: boolean) => {
    setHideCompletedAll(value);
    if (value) {
      setHideCompletedToday(true);
    }
  }, []);

  const openTaskModal = useCallback(
    (options?: { tab?: 'quick' | 'import'; quadrant?: Quadrant }) => {
      if (options?.quadrant) {
        setManualFormQuadrant(options.quadrant);
      } else if ((options?.tab ?? 'quick') === 'quick') {
        setManualFormQuadrant('backlog');
      }
      setTaskModalTab(options?.tab ?? 'quick');
      setTaskModalOpen(true);
    },
    [],
  );

  const handleQuadrantCreateRequest = useCallback(
    (quadrant: QuadrantId) => {
      openTaskModal({ quadrant, tab: 'quick' });
    },
    [openTaskModal],
  );

  const handleOpenImportModal = useCallback(() => {
    openTaskModal({ tab: 'import' });
  }, [openTaskModal]);

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
    const sessions = pomodoro.stats.completedSessions ?? [];
    if (processedPomodoroSessionsRef.current > sessions.length) {
      processedPomodoroSessionsRef.current = 0;
    }
    for (let index = processedPomodoroSessionsRef.current; index < sessions.length; index += 1) {
      const session = sessions[index];
      if (session.durationSeconds > 0) {
        addTimeToTask(session.taskId, session.durationSeconds);
      }
    }
    processedPomodoroSessionsRef.current = sessions.length;
  }, [addTimeToTask, pomodoro.stats.completedSessions]);

  const handleResetFocusMode = useCallback(() => {
    setFocusModeEnabled(false);
  }, []);

  useKeyboardShortcuts({
    searchQuery,
    setSearchQuery,
    setSearchExpanded,
    searchInputRef,
    openImportModal: handleOpenImportModal,
    importTextareaRef,
    pomodoro: {
      activeTaskId: pomodoro.activeTaskId,
      runState: pomodoro.runState,
      pause: pomodoro.pause,
      resume: pomodoro.resume,
      reset: pomodoro.reset,
    },
    moveTask,
    onResetFocusMode: handleResetFocusMode,
  });

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

  useEffect(() => {
    if (!isTaskModalOpen) {
      modalFocusHandledRef.current = null;
      return;
    }
    if (taskModalTab === 'import') {
      if (modalFocusHandledRef.current === 'import') {
        return;
      }
      modalFocusHandledRef.current = 'import';
      window.requestAnimationFrame(() => {
        importTextareaRef.current?.focus();
        importTextareaRef.current?.select?.();
      });
      return;
    }

    if (modalFocusHandledRef.current !== 'quick') {
      modalFocusHandledRef.current = 'quick';
      setManualFormFocusToken((token) => token + 1);
    }
  }, [isTaskModalOpen, taskModalTab]);

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

  useEffect(() => {
    if (!focusModeEnabled) {
      return;
    }
    if (!activeTask || !activeTask.done) {
      return;
    }
    setFocusModeEnabled(false);
    pomodoro.reset();
  }, [activeTask, focusModeEnabled, pomodoro.reset]);

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

      <header className={styles.header}>
        <PriorityOverview quadrants={quadrants} onSelect={handleSelectQuadrant} />
        <div className={styles.toolbar}>
          <SearchBar
            value={searchQuery}
            expanded={searchExpanded || !!searchQuery}
            onChange={setSearchQuery}
            onClear={handleClearFilter}
            onToggle={setSearchExpanded}
            inputRef={searchInputRef}
          />
          <AddTaskButton onClick={() => openTaskModal({ tab: 'quick' })} />
          <ThemeToggleButton theme={theme} onToggle={toggleTheme} />
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
        hideCompletedToday={hideCompletedToday}
        hideCompletedAll={hideCompletedAll}
        onPause={pomodoro.pause}
        onResume={pomodoro.resume}
        onReset={pomodoro.reset}
        onSkip={pomodoro.skip}
        onToggleFocusMode={handleToggleFocusMode}
        onUpdateConfig={pomodoro.updateConfig}
        onClearStats={pomodoro.clearStats}
        onToggleHideCompletedToday={handleHideCompletedTodayChange}
        onToggleHideCompletedAll={handleHideCompletedAllChange}
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
            onDelete={handleDeleteTask}
          />
        </div>
      ) : (
        <>
          <div className={styles.mainContent}>
            <aside className={styles.sidebar}>
              <BacklogList
                tasks={backlogDisplayTasks}
                totalCount={backlogTotalCount}
                onDropTask={handleBacklogDrop}
                onUpdateTask={handleUpdateTask}
                collapsed={searchQuery ? false : collapseState.backlog}
                onToggleCollapse={searchQuery ? () => undefined : handleToggleBacklogCollapse}
                pomodoroControls={pomodoroControls}
                title={searchQuery ? 'Результаты поиска' : 'Бэклог'}
                subtitle={
                  searchQuery
                    ? `Найдено ${backlogDisplayTasks.length} из ${allTasks.length} задач`
                    : backlogSubtitle
                }
                collapsible={!searchQuery}
                emptyMessage={
                  searchQuery
                    ? `По запросу «${searchQuery.trim()}» ничего не найдено`
                    : hideCompletedAll || hideCompletedToday
                    ? 'Нет задач после применения фильтра'
                    : undefined
                }
                showQuadrantBadge={Boolean(searchQuery.trim())}
                onDeleteTask={handleDeleteTask}
              />
              <p className={styles.hotkeysHint}>
                Горячие клавиши: / — поиск, i — импорт, Esc — очистить поиск, 0–4 — перемещение задач, P — старт/пауза, R —
                сброс таймера
              </p>
            </aside>
            <div className={styles.boardSection}>
              <QuadrantBoard
                quadrants={{
                  Q1: visibleQuadrants.Q1 ?? [],
                  Q2: visibleQuadrants.Q2 ?? [],
                  Q3: visibleQuadrants.Q3 ?? [],
                  Q4: visibleQuadrants.Q4 ?? [],
                }}
                collapsed={collapseState.quadrants}
                onDropTask={handleQuadrantDrop}
                onUpdateTask={handleUpdateTask}
                onResetTask={resetTask}
                onToggleCollapse={handleToggleQuadrantCollapse}
                onRequestCreateTask={handleQuadrantCreateRequest}
                pomodoroControls={pomodoroControls}
                onDeleteTask={handleDeleteTask}
              />
            </div>
          </div>
        </>
      )}

      <Modal open={isTaskModalOpen} onClose={() => setTaskModalOpen(false)} title="Добавление задач">
        <div className={styles.modalTabs} role="tablist" aria-label="Способ добавления задач">
          <button
            type="button"
            role="tab"
            aria-selected={taskModalTab === 'quick'}
            className={`${styles.modalTabButton} ${taskModalTab === 'quick' ? styles.modalTabActive : ''}`.trim()}
            onClick={() => setTaskModalTab('quick')}
          >
            Быстрое добавление
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={taskModalTab === 'import'}
            className={`${styles.modalTabButton} ${taskModalTab === 'import' ? styles.modalTabActive : ''}`.trim()}
            onClick={() => setTaskModalTab('import')}
          >
            Импорт JSON
          </button>
        </div>
        <div className={styles.modalContentArea}>
          {taskModalTab === 'quick' ? (
            <ManualTaskForm
              ref={manualFormRef}
              onCreateTask={handleCreateTask}
              initialQuadrant={manualFormQuadrant}
              focusTrigger={manualFormFocusToken}
              variant="modal"
            />
          ) : (
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
          )}
        </div>
      </Modal>
    </div>
  );
}
