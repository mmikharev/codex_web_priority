import { Task } from '../types';
import { parseLooseDate } from './date';

export function compareTasks(a: Task, b: Task): number {
  const doneDiff = Number(a.done ?? false) - Number(b.done ?? false);
  if (doneDiff !== 0) {
    return doneDiff;
  }

  const dateA = parseLooseDate(a.due ?? undefined);
  const dateB = parseLooseDate(b.due ?? undefined);

  if (dateA && dateB) {
    const diff = dateA.getTime() - dateB.getTime();
    if (diff !== 0) {
      return diff;
    }
  }

  if (dateA && !dateB) return -1;
  if (!dateA && dateB) return 1;

  return a.title.localeCompare(b.title, undefined, { sensitivity: 'accent' });
}

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort(compareTasks);
}
