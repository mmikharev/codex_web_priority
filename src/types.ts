export type Quadrant = 'backlog' | 'Q1' | 'Q2' | 'Q3' | 'Q4';

export type ContemplationTag =
  | 'energy_high'
  | 'energy_gentle'
  | 'mood_pleasant'
  | 'mood_neutral';

export interface Task {
  id: string;
  title: string;
  due?: string | null;
  quadrant: Quadrant;
  done?: boolean;
  createdAt?: string;
  completedAt?: string | null;
  timeSpentSeconds?: number;
  contemplationTag?: ContemplationTag | null;
  capturedViaContemplation?: boolean;
}

export type TaskMap = Record<string, Task>;
