import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Quadrant, Task, TaskMap } from '../types';
import { clearState, loadState, scheduleSave } from '../utils/storage';
import { sortTasks } from '../utils/taskSort';

interface ImportOptions {
  resetQuadrants?: boolean;
}

export interface ImportSummary {
  added: number;
  updated: number;
  total: number;
}

const TRAILING_COMMA_REGEX = /,\s*(?=[}\]])/g;

function sanitizeJson(raw: string): string {
  return raw.replace(TRAILING_COMMA_REGEX, '');
}

function normalizeDue(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function isQuadrant(value: unknown): value is Quadrant {
  return value === 'backlog' || value === 'Q1' || value === 'Q2' || value === 'Q3' || value === 'Q4';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!isPlainObject(value)) {
    return false;
  }
  return Object.values(value).every((item) => typeof item === 'string');
}

function generateTaskId(existing: TaskMap): string {
  const globalCrypto =
    typeof globalThis !== 'undefined'
      ? (globalThis.crypto as { randomUUID?: () => string } | undefined)
      : undefined;

  if (globalCrypto?.randomUUID) {
    let candidate = globalCrypto.randomUUID();
    while (existing[candidate]) {
      candidate = globalCrypto.randomUUID();
    }
    return candidate;
  }

  let attempt = 0;
  let candidate = `task-${Date.now()}`;
  while (existing[candidate]) {
    attempt += 1;
    candidate = `task-${Date.now()}-${attempt}`;
  }
  return candidate;
}

function isExportPayload(
  value: unknown,
): value is { tasks: Record<string, { title?: string; due?: string | null; quadrant?: Quadrant; done?: boolean }> } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'tasks' in value &&
    typeof (value as { tasks: unknown }).tasks === 'object' &&
    (value as { tasks: unknown }).tasks !== null
  );
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
        payload = JSON.parse(sanitizeJson(rawJson));
      } catch (error) {
        throw new Error('Невалидный JSON: ' + (error instanceof Error ? error.message : String(error)));
      }

      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('Ожидается объект вида { "task": "date" } или экспортированный JSON.');
      }

      const createBase = () => {
        const base: TaskMap = {};
        if (resetQuadrants) {
          Object.entries(tasks).forEach(([id, task]) => {
            base[id] = {
              ...task,
              quadrant: 'backlog',
              done: task.done ?? false,
            };
          });
        } else {
          Object.entries(tasks).forEach(([id, task]) => {
            base[id] = { ...task, done: task.done ?? false };
          });
        }
        return base;
      };

      let added = 0;
      let updated = 0;
      let nextTasks: TaskMap | null = null;

      if (isExportPayload(payload)) {
        const base = createBase();
        const entries = Object.entries(payload.tasks);

        for (const [id, descriptor] of entries) {
          if (!descriptor || typeof descriptor !== 'object') {
            continue;
          }

          const normalizedTitle =
            typeof descriptor.title === 'string' && descriptor.title.trim().length > 0
              ? descriptor.title.trim()
              : id;
          const normalizedDue = normalizeDue(descriptor.due ?? null);
          const normalizedQuadrant = isQuadrant(descriptor.quadrant) ? descriptor.quadrant : 'backlog';
          const normalizedDone = typeof descriptor.done === 'boolean' ? descriptor.done : false;

          if (base[id]) {
            updated += 1;
          } else {
            added += 1;
          }

          base[id] = {
            id,
            title: normalizedTitle,
            due: normalizedDue,
            quadrant: normalizedQuadrant,
            done: normalizedDone,
          };
        }

        nextTasks = base;
      } else {
        const entries = Object.entries(payload);
        const quadrantEntries = entries.filter((entry): entry is [Quadrant, Record<string, string>] => {
          const [key, value] = entry;
          if (!isQuadrant(key)) {
            return false;
          }
          return isStringRecord(value);
        });

        if (quadrantEntries.length > 0 && quadrantEntries.length === entries.length) {
          const base = createBase();

          for (const [quadrantKey, tasksMap] of quadrantEntries) {
            Object.entries(tasksMap).forEach(([id, dueValue]) => {
              const due = normalizeDue(dueValue);
              if (base[id]) {
                base[id] = {
                  ...base[id],
                  title: id,
                  due,
                  quadrant: quadrantKey,
                };
                updated += 1;
              } else {
                base[id] = {
                  id,
                  title: id,
                  due,
                  quadrant: quadrantKey,
                  done: false,
                };
                added += 1;
              }
            });
          }

          nextTasks = base;
        } else {
          if (entries.some(([, value]) => typeof value !== 'string')) {
            throw new Error('Каждое значение должно быть строкой (может быть пустой).');
          }

          const base = createBase();

          for (const [id, dueValue] of entries) {
            const due = normalizeDue(dueValue as string);
            if (base[id]) {
              base[id] = {
                ...base[id],
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
                done: false,
              };
              added += 1;
            }
          }

          nextTasks = base;
        }
      }

      if (nextTasks) {
        setTasks(nextTasks);
      }

      return { added, updated, total: added + updated };
    },
    [tasks],
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

  const updateTask = useCallback((taskId: string, updates: Partial<Pick<Task, 'title' | 'due' | 'done'>>) => {
    setTasks((prev) => {
      const current = prev[taskId];
      if (!current) {
        return prev;
      }
      const next: Task = {
        ...current,
        ...updates,
        due: updates.due !== undefined ? normalizeDue(updates.due) : current.due,
        done: updates.done !== undefined ? updates.done : current.done ?? false,
      };
      return {
        ...prev,
        [taskId]: next,
      };
    });
  }, []);

  const addTask = useCallback((task: { title: string; due: string | null; quadrant: Quadrant }) => {
    setTasks((prev) => {
      const normalizedTitle = task.title.trim() || 'Новая задача';
      const normalizedQuadrant = isQuadrant(task.quadrant) ? task.quadrant : 'backlog';
      const normalizedDue = normalizeDue(task.due);
      const id = generateTaskId(prev);

      return {
        ...prev,
        [id]: {
          id,
          title: normalizedTitle,
          due: normalizedDue,
          quadrant: normalizedQuadrant,
          done: false,
        },
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
      backlog: sortTasks(list.filter((task) => task.quadrant === 'backlog')),
      Q1: sortTasks(list.filter((task) => task.quadrant === 'Q1')),
      Q2: sortTasks(list.filter((task) => task.quadrant === 'Q2')),
      Q3: sortTasks(list.filter((task) => task.quadrant === 'Q3')),
      Q4: sortTasks(list.filter((task) => task.quadrant === 'Q4')),
    };
  }, [tasks]);

  return {
    tasks,
    quadrants,
    importTasks,
    moveTask,
    updateTask,
    resetTask,
    addTask,
    clearCorruptedState,
    loadError,
  };
}
