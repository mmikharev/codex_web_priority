import { useMemo, useState } from 'react';
import { Quadrant, Task } from '../types';
import { getTaskIdFromDrag } from '../utils/dnd';
import { TaskCard } from './TaskCard';
import styles from './QuadrantBoard.module.css';

type QuadrantId = Exclude<Quadrant, 'backlog'>;

const QUADRANT_DETAILS: Array<{
  id: QuadrantId;
  title: string;
  subtitle: string;
}> = [
  { id: 'Q1', title: 'Q1 — Срочно + Важно', subtitle: 'Срочные задачи, требующие немедленного внимания' },
  { id: 'Q2', title: 'Q2 — Несрочно + Важно', subtitle: 'Стратегические задачи и развитие' },
  { id: 'Q3', title: 'Q3 — Срочно + Неважно', subtitle: 'Делегируйте или минимизируйте' },
  { id: 'Q4', title: 'Q4 — Несрочно + Неважно', subtitle: 'Избегайте или откладывайте' },
];

interface QuadrantBoardProps {
  quadrants: Record<QuadrantId, Task[]>;
  collapsed: Record<QuadrantId, boolean>;
  onDropTask: (taskId: string, quadrant: QuadrantId) => void;
  onUpdateTask: (taskId: string, updates: { title?: string; due?: string | null; done?: boolean }) => void;
  onResetTask: (taskId: string) => void;
  onToggleCollapse: (quadrant: QuadrantId) => void;
  onRequestCreateTask?: (quadrant: QuadrantId) => void;
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
}

function QuadrantZone({
  quadrant,
  title,
  subtitle,
  tasks,
  collapsed,
  onDrop,
  onUpdateTask,
  onResetTask,
  onRequestCreateTask,
  onToggleCollapse,
  pomodoroControls,
}: {
  quadrant: QuadrantId;
  title: string;
  subtitle: string;
  tasks: Task[];
  collapsed: boolean;
  onDrop: (taskId: string, quadrant: QuadrantId) => void;
  onUpdateTask: (taskId: string, updates: { title?: string; due?: string | null; done?: boolean }) => void;
  onResetTask: (taskId: string) => void;
  onRequestCreateTask?: (quadrant: QuadrantId) => void;
  onToggleCollapse: (quadrant: QuadrantId) => void;
  pomodoroControls?: QuadrantBoardProps['pomodoroControls'];
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const stats = useMemo(() => {
    const total = tasks.length;
    const active = tasks.filter((task) => !(task.done ?? false)).length;
    const completed = total - active;
    return { total, active, completed };
  }, [tasks]);

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const taskId = getTaskIdFromDrag(event);
    if (taskId) {
      onDrop(taskId, quadrant);
    }
  };

  const handleToggle = () => {
    onToggleCollapse(quadrant);
  };

  return (
    <section className={`${styles.zone} ${collapsed ? styles.zoneCollapsed : ''}`.trim()}>
      <header className={styles.zoneHeader}>
        <div className={styles.zoneHeaderContent}>
          <h3 className={styles.zoneTitle}>{title}</h3>
          <p className={styles.zoneSubtitle}>{subtitle}</p>
        </div>
        <div className={styles.zoneStats}>
          <span className={styles.zoneStatsItem}>
            Активных: <strong>{stats.active}</strong>
          </span>
          <span className={styles.zoneStatsItem}>
            Выполнено: <strong>{stats.completed}</strong>
          </span>
        </div>
        <button
          type="button"
          className={styles.toggleButton}
          onClick={handleToggle}
          aria-expanded={!collapsed}
          aria-controls={`quadrant-${quadrant}`}
        >
          {collapsed ? 'Развернуть' : 'Свернуть'}
        </button>
      </header>
      {!collapsed ? (
        <>
          <div
            id={`quadrant-${quadrant}`}
            className={`${styles.dropArea} ${isDragOver ? styles.dragOver : ''}`.trim()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {tasks.length === 0 ? (
              <div className={styles.emptyState}>Перетащите задачу сюда</div>
            ) : (
              tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onUpdate={onUpdateTask}
                  onReset={onResetTask}
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
                />
              ))
            )}
          </div>

          {quadrant === 'Q4' && onRequestCreateTask ? (
            <button
              type="button"
              className={styles.addButton}
              aria-label={`Добавить задачу в квадрант ${quadrant}`}
              onClick={() => onRequestCreateTask(quadrant)}
            >
              + Добавить задачу
            </button>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export function QuadrantBoard({
  quadrants,
  collapsed,
  onDropTask,
  onUpdateTask,
  onResetTask,
  onToggleCollapse,
  onRequestCreateTask,
  pomodoroControls,
}: QuadrantBoardProps) {
  return (
    <div className={styles.board}>
      {QUADRANT_DETAILS.map(({ id, title, subtitle }) => (
        <QuadrantZone
          key={id}
          quadrant={id as QuadrantId}
          title={title}
          subtitle={subtitle}
          tasks={quadrants[id] ?? []}
          collapsed={collapsed[id as QuadrantId] ?? false}
          onDrop={onDropTask}
          onUpdateTask={onUpdateTask}
          onResetTask={onResetTask}
          onRequestCreateTask={onRequestCreateTask}
          onToggleCollapse={onToggleCollapse}
          pomodoroControls={pomodoroControls}
        />
      ))}
    </div>
  );
}
