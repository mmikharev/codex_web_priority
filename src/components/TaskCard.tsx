import { useEffect, useRef, useState } from 'react';
import { Task } from '../types';
import { formatDate, fromDateTimeLocalInput, toDateTimeLocalInputValue } from '../utils/date';
import { setTaskDragData } from '../utils/dnd';
import styles from './TaskCard.module.css';

interface TaskCardProps {
  task: Task;
  onUpdate?: (taskId: string, updates: { title?: string; due?: string | null; done?: boolean }) => void;
  onReset?: (taskId: string) => void;
}

export function TaskCard({ task, onUpdate, onReset }: TaskCardProps) {
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
        {onReset && task.quadrant !== 'backlog' ? (
          <button
            type="button"
            className={styles.backlogButton}
            onMouseDown={handleBacklogMouseDown}
            onClick={() => onReset(task.id)}
          >
            ↩︎ В бэклог
          </button>
        ) : null}
      </div>
      <div className={styles.dueRow}>
        {editingField === 'due' ? (
          <div className={styles.fieldGroup}>
            <input
              ref={dueInputRef}
              className={`${styles.input} ${dueError ? styles.inputError : ''}`.trim()}
              type="datetime-local"
              value={draftDue}
              onChange={(event) => setDraftDue(event.target.value)}
              onBlur={handleDueBlur}
              onKeyDown={handleDueKeyDown}
              step={60}
              data-task-editor="due"
            />
            {dueError ? <div className={styles.error}>{dueError}</div> : null}
          </div>
        ) : (
          <button type="button" className={styles.dueButton} onClick={startDueEditing}>
            {task.due ? formatDate(task.due) : 'Без даты'}
          </button>
        )}
      </div>
    </div>
  );
}
