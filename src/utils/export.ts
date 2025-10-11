import { Quadrant, TaskMap } from '../types';

export interface ExportedTaskSnapshot {
  title: string;
  due: string | null;
  quadrant: Quadrant;
  done: boolean;
  createdAt?: string;
  completedAt?: string | null;
  timeSpentSeconds?: number;
  contemplationTag?: string | null;
  capturedViaContemplation?: boolean;
}

export interface ExportPayloadV2 {
  version: 2;
  exportedAt: string;
  tasks: Record<string, ExportedTaskSnapshot>;
}

export function createExportPayload(tasks: TaskMap, exportedAt: Date = new Date()): ExportPayloadV2 {
  const snapshot: Record<string, ExportedTaskSnapshot> = {};

  Object.values(tasks).forEach((task) => {
    snapshot[task.id] = {
      title: task.title,
      due: task.due ?? null,
      quadrant: task.quadrant,
      done: task.done ?? false,
      createdAt: task.createdAt,
      completedAt: task.completedAt ?? null,
      timeSpentSeconds: task.timeSpentSeconds,
      contemplationTag: task.contemplationTag ?? null,
      capturedViaContemplation: task.capturedViaContemplation ?? false,
    };
  });

  return {
    version: 2,
    exportedAt: exportedAt.toISOString(),
    tasks: snapshot,
  };
}
