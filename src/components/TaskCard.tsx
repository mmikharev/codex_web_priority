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
  onDelete?: (taskId: string) => void;
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

function formatDurationShort(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return '0м';
  }
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes === 0) {
    return '<1м';
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours && minutes) {
    return `${hours}ч ${minutes}м`;
  }
  if (hours) {
    return `${hours}ч`;
  }
  return `${minutes}м`;
}

export function TaskCard({ task, onUpdate, onReset, pomodoro, showQuadrantBadge = false, onDelete }: TaskCardProps) {
  const [editingField, setEditingField] = useState<'title' | 'due' | null>(null);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [draftDue, setDraftDue] = useState(() => toDateTimeLocalInputValue(task.due));
  const [titleError, setTitleError] = useState<string | null>(null);
  const [dueError, setDueError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const dueInputRef = useRef<HTMLInputElement>(null);
  const done = task.done ?? false;
  const [completionFlash, setCompletionFlash] = useState(false);

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

  useEffect(() => {
    if (done) {
      setCompletionFlash(true);
      const timeout = window.setTimeout(() => setCompletionFlash(false), 600);
      return () => window.clearTimeout(timeout);
    }
    setCompletionFlash(false);
    return undefined;
  }, [done]);

  const handleBacklogMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  const handleDeleteClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onDelete?.(task.id);
  };

  const isActive = pomodoro?.activeTaskId === task.id;
  const pomodoroCount = pomodoro?.completedCount ?? 0;
  const timeSpentLabel = formatDurationShort(task.timeSpentSeconds ?? 0);

  const quadrantBadge =
    showQuadrantBadge && task.quadrant !== 'backlog' ? QUADRANT_LABELS[task.quadrant as Exclude<Quadrant, 'backlog'>] : null;

  return (
    <div
      className={`${styles.card} ${done ? styles.cardDone : ''} ${completionFlash ? styles.cardCompleted : ''}`.trim()}
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

      <div className={styles.controlRow}>
        {pomodoro ? (
          <div className={styles.timerControls}>
            {isActive ? (
              pomodoro.runState === 'running' ? (
                <button
                  type="button"
                  onClick={pomodoro.onPause}
                  className={styles.timerButton}
                  aria-label="Пауза таймера"
                >
                  <span className={styles.visuallyHidden}>Пауза таймера</span>
                  <svg viewBox="0 0 24 24" className={styles.timerIcon} aria-hidden>
                    <path d="M9 4a1 1 0 0 1 1 1v14a1 1 0 1 1-2 0V5a1 1 0 0 1 1-1Zm6 0a1 1 0 0 1 1 1v14a1 1 0 1 1-2 0V5a1 1 0 0 1 1-1Z" />
                  </svg>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={pomodoro.onResume}
                  className={styles.timerButton}
                  aria-label="Возобновить таймер"
                >
                  <span className={styles.visuallyHidden}>Возобновить таймер</span>
                  <svg viewBox="0 0 24 24" className={styles.timerIcon} aria-hidden>
                    <path d="M8.25 4.64a1 1 0 0 1 1.49-.86l9 5.36a1 1 0 0 1 0 1.72l-9 5.36A1 1 0 0 1 8 15.36V4.64Z" />
                  </svg>
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => pomodoro.onStart(task.id)}
                className={styles.timerButton}
                aria-label="Запустить таймер для задачи"
              >
                <span className={styles.visuallyHidden}>Запустить таймер для задачи</span>
                <svg viewBox="0 0 24 24" className={styles.timerIcon} aria-hidden>
                  <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm-.75 2.5a.75.75 0 0 1 1.5 0V12l3.5 2.1a.75.75 0 1 1-.75 1.3l-4-2.4a.75.75 0 0 1-.37-.64Z" />
                </svg>
              </button>
            )}
            {isActive ? (
              <button
                type="button"
                onClick={pomodoro.onReset}
                className={`${styles.timerButton} ${styles.timerButtonStop}`.trim()}
                aria-label="Остановить таймер"
              >
                <span className={styles.visuallyHidden}>Остановить таймер</span>
                <svg viewBox="0 0 24 24" className={styles.timerIcon} aria-hidden>
                  <path d="M8 8a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1Z" />
                </svg>
              </button>
            ) : null}
          </div>
        ) : null}
        <div className={styles.controlMeta}>
          <span className={styles.pomodoroBadge} title="Количество завершённых помидоров">
            <svg viewBox="0 0 24 24" aria-hidden className={styles.badgeIcon}>
              <path d="M16.24 6.34a4 4 0 0 0-2.41-1.26l.34-1.02a1 1 0 1 0-1.9-.64l-.43 1.3c-.21-.01-.41-.02-.62-.02-4.78 0-8.62 3.34-8.62 7.46 0 3.8 3.3 6.99 7.53 7.43a9 9 0 0 0 9.41-6.41c.88-3.1-.77-5.96-3.3-6.84Z" />
            </svg>
            {pomodoroCount}
          </span>
          {isActive && pomodoro ? (
            <span className={styles.timerRemaining}>{formatTime(pomodoro.remainingSeconds)}</span>
          ) : null}
          <span className={styles.timeSpent} title="Время работы над задачей">
            <svg viewBox="0 0 24 24" className={styles.badgeIcon} aria-hidden>
              <path d="M12 2a9 9 0 1 0 9 9 9 9 0 0 0-9-9Zm0 16a7 7 0 1 1 7-7 7 7 0 0 1-7 7Zm.75-10.5v3.44l2.3 2.3a.75.75 0 1 1-1.06 1.06l-2.5-2.5a.75.75 0 0 1-.22-.53V7.5a.75.75 0 0 1 1.5 0Z" />
            </svg>
            {timeSpentLabel}
          </span>
        </div>
        {onDelete ? (
          <button
            type="button"
            className={styles.deleteButton}
            onClick={handleDeleteClick}
            aria-label="Удалить задачу"
          >
            <svg viewBox="0 0 24 24" className={styles.deleteIcon} aria-hidden>
              <path d="M9 3a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2h4a1 1 0 1 1 0 2h-1v14a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V5H4a1 1 0 1 1 0-2h5Zm8 2H7v14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5Zm-7 3a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1Zm4 0a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1Z" />
            </svg>
          </button>
        ) : null}
      </div>
    </div>
  );
}
