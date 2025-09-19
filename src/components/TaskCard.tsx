import { useEffect, useRef, useState } from 'react';
import { Quadrant, Task } from '../types';
import { formatDate, fromDateTimeLocalInput, toDateTimeLocalInputValue } from '../utils/date';
import { setTaskDragData } from '../utils/dnd';
import styles from './TaskCard.module.css';

type PomodoroMode = 'focus' | 'short_break' | 'long_break' | 'idle';
type RunState = 'running' | 'paused' | 'stopped';

interface PomodoroControls {
  activeTaskId: string | null;
  mode: PomodoroMode;
  runState: RunState;
  remainingSeconds: number;
  completedCount: number;
  onStart: (taskId: string) => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
}

interface TaskCardProps {
  task: Task;
  onUpdate?: (taskId: string, updates: { title?: string; due?: string | null; done?: boolean }) => void;
  onReset?: (taskId: string) => void;
  pomodoro?: PomodoroControls;
  showQuadrantBadge?: boolean;
}

const QUADRANT_LABELS: Record<Exclude<Quadrant, 'backlog'>, string> = {
  Q1: 'Q1',
  Q2: 'Q2',
  Q3: 'Q3',
  Q4: 'Q4',
};

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function TaskCard({ task, onUpdate, onReset, pomodoro, showQuadrantBadge = false }: TaskCardProps) {
  const [editingField, setEditingField] = useState<'title' | 'due' | null>(null);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [draftDue, setDraftDue] = useState(() => toDateTimeLocalInputValue(task.due));
  const [titleError, setTitleError] = useState<string | null>(null);
  const [dueError, setDueError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const dueInputRef = useRef<HTMLInputElement>(null);
  const done = task.done ?? false;

  useEffect(() => {
    if (editingField !== 'title') {
      setDraftTitle(task.title);
    }
  }, [editingField, task.title]);

  useEffect(() => {
    if (editingField !== 'due') {
      setDraftDue(toDateTimeLocalInputValue(task.due));
    }
  }, [editingField, task.due]);

  useEffect(() => {
    if (editingField === 'title') {
      const input = titleInputRef.current;
      input?.focus();
      input?.select();
    } else if (editingField === 'due') {
      const input = dueInputRef.current;
      input?.focus();
      input?.select();
    }
  }, [editingField]);

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    if (editingField) {
      event.preventDefault();
      return;
    }
    setTaskDragData(event, task.id);
  };

  const startTitleEditing = () => {
    if (!onUpdate) {
      return;
    }
    setEditingField('title');
    setTitleError(null);
  };

  const startDueEditing = () => {
    if (!onUpdate) {
      return;
    }
    setEditingField('due');
    setDueError(null);
  };

  const commitTitle = () => {
    if (!onUpdate) {
      setEditingField(null);
      return true;
    }

    const value = draftTitle.trim();
    if (!value) {
      setTitleError('Название не может быть пустым');
      return false;
    }

    if (value !== task.title) {
      onUpdate(task.id, { title: value });
    }

    setTitleError(null);
    setEditingField(null);
    return true;
  };

  const commitDue = () => {
    if (!onUpdate) {
      setEditingField(null);
      return true;
    }

    const value = draftDue.trim();
    if (!value) {
      if (task.due) {
        onUpdate(task.id, { due: null });
      }
      setDueError(null);
      setEditingField(null);
      return true;
    }

    const normalized = fromDateTimeLocalInput(value);
    if (!normalized) {
      setDueError('Выберите корректную дату и время');
      return false;
    }

    if (normalized !== (task.due ?? '')) {
      onUpdate(task.id, { due: normalized });
    }

    setDueError(null);
    setEditingField(null);
    return true;
  };

  const cancelTitleEditing = () => {
    setDraftTitle(task.title);
    setTitleError(null);
    setEditingField(null);
  };

  const cancelDueEditing = () => {
    setDraftDue(toDateTimeLocalInputValue(task.due));
    setDueError(null);
    setEditingField(null);
  };

  const handleTitleBlur = () => {
    if (!commitTitle()) {
      window.setTimeout(() => titleInputRef.current?.focus(), 0);
    }
  };

  const handleDueBlur = () => {
    if (!commitDue()) {
      window.setTimeout(() => dueInputRef.current?.focus(), 0);
    }
  };

  const handleTitleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitTitle();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelTitleEditing();
    }
  };

  const handleDueKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitDue();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelDueEditing();
    }
  };

  const handleDoneChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate?.(task.id, { done: event.target.checked });
  };

  const handleBacklogMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  const isActive = pomodoro?.activeTaskId === task.id;
  const pomodoroMode = isActive ? pomodoro?.mode ?? 'idle' : 'idle';
  const pomodoroClass =
    pomodoroMode === 'focus'
      ? styles.pomodoroFocus
      : pomodoroMode === 'short_break'
      ? styles.pomodoroShort
      : pomodoroMode === 'long_break'
      ? styles.pomodoroLong
      : styles.pomodoroIdle;

  const pomodoroCount = pomodoro?.completedCount ?? 0;

  const quadrantBadge =
    showQuadrantBadge && task.quadrant !== 'backlog' ? QUADRANT_LABELS[task.quadrant as Exclude<Quadrant, 'backlog'>] : null;

  return (
    <div
      className={`${styles.card} ${done ? styles.cardDone : ''}`.trim()}
      draggable={!editingField}
      onDragStart={handleDragStart}
      tabIndex={0}
      data-task-id={task.id}
      data-quadrant={task.quadrant}
    >
      <div className={styles.header}>
        <label className={styles.doneToggle}>
          <input type="checkbox" checked={done} onChange={handleDoneChange} />
          <span className={styles.visuallyHidden}>Пометить выполненной</span>
        </label>
        <div className={styles.titleArea}>
          {editingField === 'title' ? (
            <>
              <input
                ref={titleInputRef}
                className={`${styles.input} ${titleError ? styles.inputError : ''}`.trim()}
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={handleTitleKeyDown}
                placeholder="Название задачи"
                data-task-editor="title"
              />
              {titleError ? <div className={styles.error}>{titleError}</div> : null}
            </>
          ) : (
            <button
              type="button"
              className={`${styles.titleButton} ${done ? styles.titleDone : ''}`.trim()}
              onClick={startTitleEditing}
            >
              {task.title}
            </button>
          )}
        </div>
        {quadrantBadge ? <span className={`${styles.quadrantBadge} ${styles[`quadrant${quadrantBadge}`] ?? ''}`.trim()}>{quadrantBadge}</span> : null}
        {onReset ? (
          <button type="button" className={styles.backlogButton} onClick={(event) => onReset(task.id)} onMouseDown={handleBacklogMouseDown}>
            В бэклог
          </button>
        ) : null}
      </div>

      <div className={styles.dueRow}>
        {editingField === 'due' ? (
          <div className={styles.fieldGroup}>
            <input
              ref={dueInputRef}
              type="datetime-local"
              className={`${styles.input} ${dueError ? styles.inputError : ''}`.trim()}
              value={draftDue}
              onChange={(event) => setDraftDue(event.target.value)}
              onBlur={handleDueBlur}
              onKeyDown={handleDueKeyDown}
              step={60}
            />
            {dueError ? <div className={styles.error}>{dueError}</div> : null}
          </div>
        ) : (
          <button type="button" className={styles.dueButton} onClick={startDueEditing}>
            {task.due ? formatDate(task.due) : 'Без срока'}
          </button>
        )}
      </div>

      {pomodoro ? (
        <div className={`${styles.pomodoro} ${pomodoroClass} ${isActive ? styles.pomodoroActive : ''}`.trim()}>
          <div className={styles.pomodoroInfo}>
            <span className={styles.pomodoroLabel}>Pomodoro</span>
            <span className={styles.pomodoroCount}>{pomodoroCount}</span>
            {isActive ? <span className={styles.pomodoroTime}>{formatTime(pomodoro.remainingSeconds)}</span> : null}
          </div>
          <div className={styles.pomodoroActions}>
            {isActive ? (
              <>
                {pomodoro.runState === 'running' ? (
                  <button
                    type="button"
                    onClick={pomodoro.onPause}
                    className={styles.pomodoroIconButton}
                    aria-label="Пауза таймера"
                  >
                    <span className={styles.visuallyHidden}>Пауза таймера</span>
                    <svg viewBox="0 0 24 24" className={styles.pomodoroIconSvg} aria-hidden>
                      <path d="M9 4a1 1 0 0 1 1 1v14a1 1 0 1 1-2 0V5a1 1 0 0 1 1-1Zm6 0a1 1 0 0 1 1 1v14a1 1 0 1 1-2 0V5a1 1 0 0 1 1-1Z" />
                    </svg>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={pomodoro.onResume}
                    className={styles.pomodoroIconButton}
                    aria-label="Возобновить таймер"
                  >
                    <span className={styles.visuallyHidden}>Возобновить таймер</span>
                    <svg viewBox="0 0 24 24" className={styles.pomodoroIconSvg} aria-hidden>
                      <path d="M8.25 4.64a1 1 0 0 1 1.49-.86l9 5.36a1 1 0 0 1 0 1.72l-9 5.36A1 1 0 0 1 8 15.36V4.64Z" />
                    </svg>
                  </button>
                )}
                <button
                  type="button"
                  onClick={pomodoro.onReset}
                  className={styles.pomodoroIconButtonSecondary}
                  aria-label="Остановить таймер"
                >
                  <span className={styles.visuallyHidden}>Остановить таймер</span>
                  <svg viewBox="0 0 24 24" className={styles.pomodoroIconSvg} aria-hidden>
                    <path d="M7 5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2Z" />
                  </svg>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => pomodoro.onStart(task.id)}
                className={styles.pomodoroIconButton}
                aria-label="Запустить таймер для задачи"
              >
                <span className={styles.visuallyHidden}>Запустить таймер для задачи</span>
                <svg viewBox="0 0 24 24" className={styles.pomodoroIconSvg} aria-hidden>
                  <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm-.75 2.5a.75.75 0 0 1 1.5 0V12l3.5 2.1a.75.75 0 1 1-.75 1.3l-4-2.4a.75.75 0 0 1-.37-.64Z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
