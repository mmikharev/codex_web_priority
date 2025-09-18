import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BacklogList } from './components/BacklogList';
import { ImportPanel } from './components/ImportPanel';
import { ManualTaskForm } from './components/ManualTaskForm';
import { QuadrantBoard } from './components/QuadrantBoard';
import { SearchBar } from './components/SearchBar';
import styles from './App.module.css';
import { useTaskStore } from './hooks/useTaskStore';
import { Quadrant, Task } from './types';
import { createExportPayload } from './utils/export';
import { sortTasks } from './utils/taskSort';

type QuadrantId = Exclude<Quadrant, 'backlog'>;

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

  const [importText, setImportText] = useState('');
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hideCompleted, setHideCompleted] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const importTextareaRef = useRef<HTMLTextAreaElement>(null);

  const backlogTasks = quadrants.backlog ?? [];
  const filteredBacklog = useMemo(
    () => filterBacklog(backlogTasks, searchQuery, hideCompleted),
    [backlogTasks, hideCompleted, searchQuery],
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

  const handleExport = useCallback(() => {
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

  const handleClearFilter = useCallback(() => {
    setSearchQuery('');
  }, []);

  const handleHideCompletedChange = useCallback((value: boolean) => {
    setHideCompleted(value);
  }, []);

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
        }
        return;
      }

      if (normalizedKey === '/') {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (normalizedKey === 'escape') {
        if (searchQuery) {
          event.preventDefault();
          setSearchQuery('');
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
  }, [moveTask, searchQuery]);

  useEffect(() => {
    if (!importText) {
      return;
    }
    setImportFeedback(null);
    setImportError(null);
  }, [importText]);

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

      <div className={styles.topRow}>
        <ImportPanel
          value={importText}
          onChange={setImportText}
          onImport={handleImport}
          onExport={handleExport}
          feedback={importFeedback}
          error={importError}
          textareaRef={importTextareaRef}
        />
        <div className={styles.sideColumn}>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onClear={handleClearFilter}
            inputRef={searchInputRef}
          />
          <ManualTaskForm onCreateTask={handleCreateTask} />
          <p className={styles.hotkeysHint}>
            Горячие клавиши: / — поиск, i — импорт, Esc — очистить поиск, 0–4 — перемещение задач
          </p>
          <BacklogList
            tasks={filteredBacklog}
            totalCount={backlogTasks.length}
            hideCompleted={hideCompleted}
            onHideCompletedChange={handleHideCompletedChange}
            onDropTask={handleBacklogDrop}
            onUpdateTask={handleUpdateTask}
          />
        </div>
      </div>

      <div className={styles.boardRow}>
        <QuadrantBoard
          quadrants={{ Q1: quadrants.Q1 ?? [], Q2: quadrants.Q2 ?? [], Q3: quadrants.Q3 ?? [], Q4: quadrants.Q4 ?? [] }}
          onDropTask={handleQuadrantDrop}
          onUpdateTask={handleUpdateTask}
          onResetTask={resetTask}
        />
      </div>
    </div>
  );
}
