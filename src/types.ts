export type Quadrant = 'backlog' | 'Q1' | 'Q2' | 'Q3' | 'Q4';

export interface Task {
  id: string;
  title: string;
  due?: string | null;
  quadrant: Quadrant;
}

export type TaskMap = Record<string, Task>;
