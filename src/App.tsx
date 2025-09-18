import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BacklogList } from './components/BacklogList';
import { ImportPanel } from './components/ImportPanel';
import { QuadrantBoard } from './components/QuadrantBoard';
import { SearchBar } from './components/SearchBar';
import styles from './App.module.css';
import { useTaskStore } from './hooks/useTaskStore';
import { parseLooseDate } from './utils/date';
import { Quadrant, Task, TaskMap } from './types';

type QuadrantId = Exclude<Quadrant, 'backlog'>;

function sortBacklog(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const dateA = parseLooseDate(a.due ?? undefined);
    const dateB = parseLooseDate(b.due ?? undefined);

    if (dateA && dateB) {
      const diff = dateA.getTime() - dateB.getTime();
      if (diff !== 0) {
        return diff;
      }
    }

    if (dateA && !dateB) return -1;
    if (!dateA && dateB) return 1;

    return a.title.localeCompare(b.title, undefined, { sensitivity: 'accent' });
  });
}

function filterBacklog(tasks: Task[], query: string): Task[] {
  if (!query.trim()) {
    return sortBacklog(tasks);
  }

  const normalized = query.trim().toLowerCase();
  const filtered = tasks.filter((task) => {
    const haystack = `${task.title} ${task.due ?? ''}`.toLowerCase();
    return haystack.includes(normalized);
  });

  return sortBacklog(filtered);
}

function buildExportPayload(tasks: TaskMap) {
  const payload: Record<string, { title: string; due: string | null; quadrant: Quadrant }> = {};
  Object.values(tasks).forEach((task) => {
    payload[task.id] = {
      title: task.title,
      due: task.due ?? null,
      quadrant: task.quadrant,
    };
  });
  return payload;
}

export default function App() {
  const {
    tasks,
    quadrants,
    importTasks,
    moveTask,
    updateTask,
    resetTask,
    clearCorruptedState,
    loadError,
  } = useTaskStore();

  const [importText, setImportText] = useState('');
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const importTextareaRef = useRef<HTMLTextAreaElement>(null);

  const backlogTasks = quadrants.backlog ?? [];
  const filteredBacklog = useMemo(() => filterBacklog(backlogTasks, searchQuery), [backlogTasks, searchQuery]);

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
    (taskId: string, updates: { title?: string; due?: string | null }) => {
      updateTask(taskId, updates);
    },
    [updateTask],
  );

  const handleExport = useCallback(() => {
    const exportPayload = buildExportPayload(tasks);
    const json = JSON.stringify({ tasks: exportPayload }, null, 2);

    const copyToClipboard = async () => {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(json);
        setImportFeedback('JSON сохранён в буфер обмена');
      } else {
        throw new Error('Clipboard API is unavailable');
      }
    };

    copyToClipboard().catch(() => {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'eisenhower-matrix.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setImportFeedback('JSON скачан как файл eisenhower-matrix.json');
    });
  }, [tasks]);

  const handleClearFilter = useCallback(() => {
    setSearchQuery('');
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey) {
        const key = event.key.toLowerCase();
        if (key === 'f') {
          event.preventDefault();
          searchInputRef.current?.focus();
        } else if (key === 'i') {
          event.preventDefault();
          importTextareaRef.current?.focus();
        } else if (key === 'c') {
          event.preventDefault();
          setSearchQuery('');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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
        <div>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onClear={handleClearFilter}
            inputRef={searchInputRef}
          />
          <p className={styles.hotkeysHint}>
            Горячие клавиши: Ctrl+Shift+F — поиск, Ctrl+Shift+I — импорт, Ctrl+Shift+C — очистить фильтр
          </p>
          <BacklogList tasks={filteredBacklog} onDropTask={handleBacklogDrop} onUpdateTask={handleUpdateTask} />
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
