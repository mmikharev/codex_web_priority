import { useLayoutEffect, useRef, useState } from 'react';
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
  onDropTask: (taskId: string, quadrant: QuadrantId) => void;
  onUpdateTask: (taskId: string, updates: { title?: string; due?: string | null; done?: boolean }) => void;
  onResetTask: (taskId: string) => void;
}

function QuadrantZone({
  quadrant,
  title,
  subtitle,
  tasks,
  onDrop,
  onUpdateTask,
  onResetTask,
}: {
  quadrant: QuadrantId;
  title: string;
  subtitle: string;
  tasks: Task[];
  onDrop: (taskId: string, quadrant: QuadrantId) => void;
  onUpdateTask: (taskId: string, updates: { title?: string; due?: string | null; done?: boolean }) => void;
  onResetTask: (taskId: string) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const dropAreaRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const dropArea = dropAreaRef.current;
    if (!dropArea || typeof window === 'undefined') {
      return;
    }

    const hasResizeObserver = typeof window.ResizeObserver !== 'undefined';
    const hasMutationObserver = typeof window.MutationObserver !== 'undefined';

    const updateMaxHeight = () => {
      if (!dropArea) {
        return;
      }

      const cards = Array.from(dropArea.querySelectorAll<HTMLElement>('[data-task-id]'));
      const limit = Math.min(cards.length, 3);

      if (limit === 0) {
        dropArea.style.removeProperty('--quadrant-max-height');
        return;
      }

      let totalHeight = 0;
      for (let index = 0; index < limit; index += 1) {
        const card = cards[index];
        totalHeight += card.getBoundingClientRect().height;
        if (index < limit - 1) {
          totalHeight += parseFloat(window.getComputedStyle(card).marginBottom || '0');
        }
      }

      const areaStyles = window.getComputedStyle(dropArea);
      const verticalChrome =
        parseFloat(areaStyles.paddingTop || '0') +
        parseFloat(areaStyles.paddingBottom || '0') +
        parseFloat(areaStyles.borderTopWidth || '0') +
        parseFloat(areaStyles.borderBottomWidth || '0');

      dropArea.style.setProperty('--quadrant-max-height', `${Math.ceil(totalHeight + verticalChrome)}px`);
    };

    updateMaxHeight();

    if (!hasResizeObserver) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      updateMaxHeight();
    });

    const observeElements = () => {
      resizeObserver.disconnect();
      resizeObserver.observe(dropArea);
      const cards = Array.from(dropArea.querySelectorAll<HTMLElement>('[data-task-id]'));
      cards.forEach((card) => resizeObserver.observe(card));
    };

    observeElements();

    if (hasMutationObserver) {
      const mutationObserver = new MutationObserver(() => {
        observeElements();
        updateMaxHeight();
      });

      mutationObserver.observe(dropArea, { childList: true, subtree: true });

      return () => {
        resizeObserver.disconnect();
        mutationObserver.disconnect();
      };
    }

    return () => {
      resizeObserver.disconnect();
    };
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

  return (
    <section className={styles.zone}>
      <header className={styles.zoneHeader}>
        <h3 className={styles.zoneTitle}>{title}</h3>
        <p className={styles.zoneSubtitle}>{subtitle}</p>
      </header>
      <div
        ref={dropAreaRef}
        className={`${styles.dropArea} ${isDragOver ? styles.dragOver : ''}`.trim()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {tasks.length === 0 ? (
          <div className={styles.emptyState}>Перетащите задачу сюда</div>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} onUpdate={onUpdateTask} onReset={onResetTask} />
          ))
        )}
      </div>
    </section>
  );
}

export function QuadrantBoard({ quadrants, onDropTask, onUpdateTask, onResetTask }: QuadrantBoardProps) {
  return (
    <div className={styles.board}>
      {QUADRANT_DETAILS.map(({ id, title, subtitle }) => (
        <QuadrantZone
          key={id}
          quadrant={id as QuadrantId}
          title={title}
          subtitle={subtitle}
          tasks={quadrants[id] ?? []}
          onDrop={onDropTask}
          onUpdateTask={onUpdateTask}
          onResetTask={onResetTask}
        />
      ))}
    </div>
  );
}
