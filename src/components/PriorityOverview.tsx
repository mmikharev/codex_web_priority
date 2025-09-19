import { CSSProperties } from 'react';
import { Quadrant, Task } from '../types';
import styles from './PriorityOverview.module.css';

interface PriorityOverviewProps {
  quadrants: Record<Quadrant, Task[]>;
  onSelect?: (quadrant: Quadrant) => void;
}

const TITLES: Record<Exclude<Quadrant, 'backlog'>, string> = {
  Q1: 'Срочно + Важно',
  Q2: 'Несрочно + Важно',
  Q3: 'Срочно + Неважно',
  Q4: 'Несрочно + Неважно',
};

const COLORS: Record<Exclude<Quadrant, 'backlog'>, string> = {
  Q1: '#ef4444',
  Q2: '#22c55e',
  Q3: '#f97316',
  Q4: '#8b5cf6',
};

function getStats(tasks: Task[]) {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.done ?? false).length;
  return { total, completed };
}

export function PriorityOverview({ quadrants, onSelect }: PriorityOverviewProps) {
  return (
    <div className={styles.grid}>
      {(Object.keys(TITLES) as Array<Exclude<Quadrant, 'backlog'>>).map((quadrant) => {
        const stats = getStats(quadrants[quadrant] ?? []);
        return (
          <button
            key={quadrant}
            type="button"
            className={styles.card}
            style={
              { '--accent-color': COLORS[quadrant] } as CSSProperties
            }
            onClick={() => onSelect?.(quadrant)}
          >
            <span className={styles.quadrant}>{quadrant}</span>
            <span className={styles.title}>{TITLES[quadrant]}</span>
            <span className={styles.counter}>
              {stats.completed}
              <span className={styles.counterTotal}>/{stats.total}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
