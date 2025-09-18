import { useState } from 'react';
import { Task } from '../types';
import { getTaskIdFromDrag } from '../utils/dnd';
import { TaskCard } from './TaskCard';
import styles from './BacklogList.module.css';

interface BacklogListProps {
  tasks: Task[];
  totalCount?: number;
  hideCompleted: boolean;
  onHideCompletedChange: (value: boolean) => void;
  onDropTask: (taskId: string) => void;
  onUpdateTask: (taskId: string, updates: { title?: string; due?: string | null; done?: boolean }) => void;
}

export function BacklogList({
  tasks,
  totalCount,
  hideCompleted,
  onHideCompletedChange,
  onDropTask,
  onUpdateTask,
}: BacklogListProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const displayedCount = totalCount ?? tasks.length;

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const taskId = getTaskIdFromDrag(event);
    if (taskId) {
      onDropTask(taskId);
    }
  };

  return (
    <section className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Бэклог</h2>
          <span className={styles.count}>{displayedCount}</span>
        </div>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={hideCompleted}
            onChange={(event) => onHideCompletedChange(event.target.checked)}
          />
          Скрыть выполненные
        </label>
      </div>
      <div
        className={`${styles.list} ${isDragOver ? styles.dragOver : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {tasks.length === 0 ? (
          <div className={styles.empty}>
            {hideCompleted
              ? 'Нет задач для отображения. Попробуйте отключить фильтр «Скрыть выполненные».'
              : 'Все задачи распределены по квадрантам'}
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} onUpdate={onUpdateTask} />
          ))
        )}
      </div>
    </section>
  );
}
