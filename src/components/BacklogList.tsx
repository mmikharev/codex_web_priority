import { useState } from 'react';
import { Task } from '../types';
import { getTaskIdFromDrag } from '../utils/dnd';
import { TaskCard } from './TaskCard';
import styles from './BacklogList.module.css';

interface BacklogListProps {
  tasks: Task[];
  totalCount?: number;
  onDropTask: (taskId: string) => void;
  onUpdateTask: (taskId: string, updates: { title?: string; due?: string | null; done?: boolean }) => void;
  collapsed: boolean;
  onToggleCollapse?: () => void;
  pomodoroControls?: {
    activeTaskId: string | null;
    mode: 'focus' | 'short_break' | 'long_break' | 'idle';
    runState: 'running' | 'paused' | 'stopped';
    remainingSeconds: number;
    stats: Record<string, number>;
    onStart: (taskId: string) => void;
    onPause: () => void;
    onResume: () => void;
    onReset: () => void;
  };
  title?: string;
  subtitle?: string;
  collapsible?: boolean;
  emptyMessage?: string;
  showQuadrantBadge?: boolean;
  onDeleteTask: (taskId: string) => void;
}

export function BacklogList({
  tasks,
  totalCount,
  onDropTask,
  onUpdateTask,
  collapsed,
  onToggleCollapse = () => undefined,
  pomodoroControls,
  title,
  subtitle,
  collapsible = true,
  emptyMessage,
  showQuadrantBadge = false,
  onDeleteTask,
}: BacklogListProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const displayedCount = totalCount ?? tasks.length;
  const listId = 'backlog-drop-area';

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
    <section className={`${styles.container} ${collapsed ? styles.collapsed : ''}`.trim()}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <h2 className={styles.title}>{title ?? 'Бэклог'}</h2>
          <span className={styles.count}>{displayedCount}</span>
          {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
        </div>
        <div className={styles.headerActions}>
          {collapsible ? (
            <button
              type="button"
              className={styles.toggleButton}
              onClick={onToggleCollapse}
              aria-expanded={!collapsed}
              aria-controls={listId}
            >
              {collapsed ? 'Развернуть' : 'Свернуть'}
            </button>
          ) : null}
        </div>
      </div>
      {!collapsed && (
        <div
          id={listId}
          className={`${styles.list} ${isDragOver ? styles.dragOver : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {tasks.length === 0 ? (
            <div className={styles.empty}>
              {emptyMessage
                ? emptyMessage
                : 'Все задачи распределены по квадрантам'}
            </div>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onUpdate={onUpdateTask}
                pomodoro={
                  pomodoroControls
                    ? {
                        activeTaskId: pomodoroControls.activeTaskId,
                        mode: pomodoroControls.mode,
                        runState: pomodoroControls.runState,
                        remainingSeconds: pomodoroControls.remainingSeconds,
                        completedCount: pomodoroControls.stats[task.id] ?? 0,
                        onStart: pomodoroControls.onStart,
                        onPause: pomodoroControls.onPause,
                        onResume: pomodoroControls.onResume,
                        onReset: pomodoroControls.onReset,
                      }
                    : undefined
                }
                showQuadrantBadge={showQuadrantBadge}
                onDelete={onDeleteTask}
              />
            ))
          )}
        </div>
      )}
    </section>
  );
}
