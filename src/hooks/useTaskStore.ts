import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Quadrant, Task, TaskMap } from '../types';
import { clearState, loadState, scheduleSave } from '../utils/storage';

interface ImportOptions {
  resetQuadrants?: boolean;
}

export interface ImportSummary {
  added: number;
  updated: number;
  total: number;
}

function normalizeDue(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function useTaskStore() {
  const loadRef = useRef(loadState());
  const [tasks, setTasks] = useState<TaskMap>(loadRef.current.tasks);
  const [loadError, setLoadError] = useState<Error | undefined>(loadRef.current.error);

  useEffect(() => {
    scheduleSave(tasks);
  }, [tasks]);

  const importTasks = useCallback(
    (rawJson: string, options: ImportOptions = {}): ImportSummary => {
      const { resetQuadrants = false } = options;

      let payload: unknown;
      try {
        payload = JSON.parse(rawJson);
      } catch (error) {
        throw new Error('Невалидный JSON: ' + (error instanceof Error ? error.message : String(error)));
      }

      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('Ожидается объект вида { "task": "date" }');
      }

      const entries = Object.entries(payload);
      if (entries.some(([, value]) => typeof value !== 'string')) {
        throw new Error('Каждое значение должно быть строкой (может быть пустой).');
      }

      let added = 0;
      let updated = 0;

      setTasks((prev) => {
        const base: TaskMap = {};

        if (resetQuadrants) {
          Object.entries(prev).forEach(([id, task]) => {
            base[id] = { ...task, quadrant: 'backlog' };
          });
        } else {
          Object.assign(base, prev);
        }

        for (const [id, dueValue] of entries) {
          const due = normalizeDue(dueValue as string);
          const existing = base[id];
          if (existing) {
            base[id] = {
              ...existing,
              title: id,
              due,
            };
            updated += 1;
          } else {
            base[id] = {
              id,
              title: id,
              due,
              quadrant: 'backlog',
            };
            added += 1;
          }
        }

        return base;
      });

      return { added, updated, total: added + updated };
    },
    [],
  );

  const moveTask = useCallback((taskId: string, quadrant: Quadrant) => {
    setTasks((prev) => {
      const current = prev[taskId];
      if (!current || current.quadrant === quadrant) {
        return prev;
      }
      return {
        ...prev,
        [taskId]: { ...current, quadrant },
      };
    });
  }, []);

  const updateTask = useCallback((taskId: string, updates: Partial<Pick<Task, 'title' | 'due'>>) => {
    setTasks((prev) => {
      const current = prev[taskId];
      if (!current) {
        return prev;
      }
      const next: Task = {
        ...current,
        ...updates,
        due: updates.due !== undefined ? normalizeDue(updates.due) : current.due,
      };
      return {
        ...prev,
        [taskId]: next,
      };
    });
  }, []);

  const resetTask = useCallback((taskId: string) => {
    moveTask(taskId, 'backlog');
  }, [moveTask]);

  const clearCorruptedState = useCallback(() => {
    clearState();
    setTasks({});
    setLoadError(undefined);
  }, []);

  const quadrants = useMemo(() => {
    const list = Object.values(tasks);
    return {
      backlog: list.filter((task) => task.quadrant === 'backlog'),
      Q1: list.filter((task) => task.quadrant === 'Q1'),
      Q2: list.filter((task) => task.quadrant === 'Q2'),
      Q3: list.filter((task) => task.quadrant === 'Q3'),
      Q4: list.filter((task) => task.quadrant === 'Q4'),
    };
  }, [tasks]);

  return {
    tasks,
    quadrants,
    importTasks,
    moveTask,
    updateTask,
    resetTask,
    clearCorruptedState,
    loadError,
  };
}
