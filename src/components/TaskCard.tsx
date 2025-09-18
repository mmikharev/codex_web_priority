import { FormEvent, useState } from 'react';
import { Task } from '../types';
import { formatDate } from '../utils/date';
import { setTaskDragData } from '../utils/dnd';
import styles from './TaskCard.module.css';

interface TaskCardProps {
  task: Task;
  onUpdate?: (taskId: string, updates: { title?: string; due?: string | null }) => void;
  onReset?: (taskId: string) => void;
}

export function TaskCard({ task, onUpdate, onReset }: TaskCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [draftDue, setDraftDue] = useState(task.due ?? '');

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    setTaskDragData(event, task.id);
  };

  const handleEdit = () => {
    setDraftTitle(task.title);
    setDraftDue(task.due ?? '');
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!onUpdate) {
      setIsEditing(false);
      return;
    }

    onUpdate(task.id, {
      title: draftTitle.trim() || task.id,
      due: draftDue,
    });
    setIsEditing(false);
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  return (
    <div className={styles.card} draggable={!isEditing} onDragStart={handleDragStart}>
      <div className={styles.header}>
        <h3 className={styles.title}>{task.title}</h3>
        <div className={styles.actions}>
          {onReset && task.quadrant !== 'backlog' ? (
            <button
              type="button"
              className={styles.actionButton}
              onMouseDown={handleMouseDown}
              onClick={() => onReset(task.id)}
            >
              В бэклог
            </button>
          ) : null}
          {onUpdate ? (
            <button
              type="button"
              className={styles.actionButton}
              onMouseDown={handleMouseDown}
              onClick={handleEdit}
            >
              Редактировать
            </button>
          ) : null}
        </div>
      </div>
      <div className={styles.due}>{formatDate(task.due)}</div>

      {isEditing ? (
        <form className={styles.editForm} onSubmit={handleSubmit}>
          <input
            className={styles.input}
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            placeholder="Название задачи"
            autoFocus
          />
          <input
            className={styles.input}
            value={draftDue}
            onChange={(event) => setDraftDue(event.target.value)}
            placeholder="Дата: 1. 10. 2025 at 0:00"
          />
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelButton} onClick={handleCancel}>
              Отмена
            </button>
            <button type="submit" className={styles.saveButton}>
              Сохранить
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
