import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ContemplationTag, Quadrant, Task, TaskMap } from '../types';
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

function sanitizeJson(raw: string): string {
  let result = '';
  let inString = false;
  let escapeNext = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index]!;

    if (!inString && char === ',') {
      let lookahead = index + 1;
      while (lookahead < raw.length && /\s/.test(raw[lookahead]!)) {
        lookahead += 1;
      }
      const next = raw[lookahead];
      if (next === '}' || next === ']') {
        escapeNext = false;
        continue;
      }
    }

    result += char;

    if (char === '"' && !escapeNext) {
      inString = !inString;
    }
    escapeNext = !escapeNext && char === '\\';
  }

  return result;
}

function normalizeDue(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function finalizeTask(input: {
  id: string;
  title: string;
  due: string | null;
  quadrant: Quadrant;
  done: boolean;
  createdAt?: string;
  completedAt?: string | null;
  timeSpentSeconds?: number;
  contemplationTag?: ContemplationTag | null;
  capturedViaContemplation?: boolean;
}): Task {
  const createdAt = typeof input.createdAt === 'string' ? input.createdAt : new Date().toISOString();
  const completedAt = typeof input.completedAt === 'string' ? input.completedAt : null;
  const timeSpentSeconds = typeof input.timeSpentSeconds === 'number' ? Math.max(0, input.timeSpentSeconds) : 0;

  return {
    id: input.id,
    title: input.title,
    due: normalizeDue(input.due),
    quadrant: input.quadrant,
    done: input.done,
    createdAt,
    completedAt,
    timeSpentSeconds,
    contemplationTag: input.contemplationTag ?? null,
    capturedViaContemplation: input.capturedViaContemplation ?? false,
  };
}

function isQuadrant(value: unknown): value is Quadrant {
  return value === 'backlog' || value === 'Q1' || value === 'Q2' || value === 'Q3' || value === 'Q4';
}

function isContemplationTag(value: unknown): value is ContemplationTag {
  return (
    value === 'energy_high' ||
    value === 'energy_gentle' ||
    value === 'mood_pleasant' ||
    value === 'mood_neutral'
  );
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
): value is {
  tasks: Record<
    string,
    {
      title?: string;
      due?: string | null;
      quadrant?: Quadrant;
      done?: boolean;
      createdAt?: string;
      completedAt?: string | null;
      timeSpentSeconds?: number;
      contemplationTag?: ContemplationTag | null;
      capturedViaContemplation?: boolean;
    }
  >;
} {
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
            base[id] = finalizeTask({
              id,
              title: task.title,
              due: task.due ?? null,
              quadrant: 'backlog',
              done: task.done ?? false,
              createdAt: task.createdAt,
              completedAt: task.completedAt,
              timeSpentSeconds: task.timeSpentSeconds,
              contemplationTag: task.contemplationTag ?? null,
              capturedViaContemplation: task.capturedViaContemplation ?? false,
            });
          });
        } else {
          Object.entries(tasks).forEach(([id, task]) => {
            base[id] = finalizeTask({
              id,
              title: task.title,
              due: task.due ?? null,
              quadrant: task.quadrant,
              done: task.done ?? false,
              createdAt: task.createdAt,
              completedAt: task.completedAt,
              timeSpentSeconds: task.timeSpentSeconds,
              contemplationTag: task.contemplationTag ?? null,
              capturedViaContemplation: task.capturedViaContemplation ?? false,
            });
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

          const current = base[id];
          const normalizedTitle =
            typeof descriptor.title === 'string' && descriptor.title.trim().length > 0
              ? descriptor.title.trim()
              : current?.title ?? id;
          const normalizedDue = normalizeDue(descriptor.due ?? null);
          const normalizedQuadrant = isQuadrant(descriptor.quadrant)
            ? descriptor.quadrant
            : current?.quadrant ?? 'backlog';
          const normalizedDone =
            typeof descriptor.done === 'boolean' ? descriptor.done : current?.done ?? false;
          const normalizedCreatedAt =
            typeof descriptor.createdAt === 'string' && descriptor.createdAt.trim().length > 0
              ? descriptor.createdAt
              : current?.createdAt;
          const normalizedCompletedAt =
            typeof descriptor.completedAt === 'string' && descriptor.completedAt.trim().length > 0
              ? descriptor.completedAt
              : normalizedDone
              ? current?.completedAt ?? null
              : null;
          const normalizedTimeSpent =
            typeof descriptor.timeSpentSeconds === 'number' && Number.isFinite(descriptor.timeSpentSeconds)
              ? Math.max(0, descriptor.timeSpentSeconds)
              : current?.timeSpentSeconds;
          const normalizedTag = isContemplationTag((descriptor as { contemplationTag?: unknown }).contemplationTag)
            ? ((descriptor as { contemplationTag?: unknown }).contemplationTag as ContemplationTag)
            : current?.contemplationTag ?? null;
          const normalizedCaptured =
            typeof (descriptor as { capturedViaContemplation?: unknown }).capturedViaContemplation === 'boolean'
              ? Boolean((descriptor as { capturedViaContemplation?: unknown }).capturedViaContemplation)
              : current?.capturedViaContemplation ?? false;

          if (base[id]) {
            updated += 1;
          } else {
            added += 1;
          }

          base[id] = finalizeTask({
            id,
            title: normalizedTitle,
            due: normalizedDue,
            quadrant: normalizedQuadrant,
            done: normalizedDone,
            createdAt: normalizedCreatedAt ?? current?.createdAt,
            completedAt: normalizedDone ? normalizedCompletedAt : null,
            timeSpentSeconds: normalizedTimeSpent,
            contemplationTag: normalizedTag,
            capturedViaContemplation: normalizedCaptured,
          });
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
                const current = base[id];
                base[id] = finalizeTask({
                  id,
                  title: current.title,
                  due,
                  quadrant: quadrantKey,
                  done: current.done ?? false,
                  createdAt: current.createdAt,
                  completedAt: current.completedAt,
                  timeSpentSeconds: current.timeSpentSeconds,
                  contemplationTag: current.contemplationTag ?? null,
                  capturedViaContemplation: current.capturedViaContemplation ?? false,
                });
                updated += 1;
              } else {
                base[id] = finalizeTask({
                  id,
                  title: id,
                  due,
                  quadrant: quadrantKey,
                  done: false,
                  contemplationTag: null,
                  capturedViaContemplation: false,
                });
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
              const current = base[id];
              base[id] = finalizeTask({
                id,
                title: current.title,
                due,
                quadrant: current.quadrant,
                done: current.done ?? false,
                createdAt: current.createdAt,
                completedAt: current.completedAt,
                timeSpentSeconds: current.timeSpentSeconds,
                contemplationTag: current.contemplationTag ?? null,
                capturedViaContemplation: current.capturedViaContemplation ?? false,
              });
              updated += 1;
            } else {
              base[id] = finalizeTask({
                id,
                title: id,
                due,
                quadrant: 'backlog',
                done: false,
                contemplationTag: null,
                capturedViaContemplation: false,
              });
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

  const updateTask = useCallback((taskId: string, updates: Partial<Pick<Task, 'title' | 'due' | 'done' | 'timeSpentSeconds' | 'contemplationTag'>>) => {
    setTasks((prev) => {
      const current = prev[taskId];
      if (!current) {
        return prev;
      }
      const nextDone = updates.done !== undefined ? updates.done : current.done ?? false;
      const completedAt =
        updates.done !== undefined
          ? updates.done
            ? new Date().toISOString()
            : null
          : current.completedAt ?? null;
      const createdAt = current.createdAt ?? new Date().toISOString();
      const nextTimeSpent =
        updates.timeSpentSeconds !== undefined
          ? Math.max(0, updates.timeSpentSeconds)
          : typeof current.timeSpentSeconds === 'number'
          ? current.timeSpentSeconds
          : 0;
      const autoTimeSpent =
        updates.done && !current.done && completedAt
          ? Math.max(0, new Date(completedAt).getTime() - new Date(createdAt).getTime()) / 1000
          : nextTimeSpent;
      const finalTimeSpent = Math.max(nextTimeSpent, autoTimeSpent);
      const next: Task = {
        ...current,
        ...updates,
        due: updates.due !== undefined ? normalizeDue(updates.due) : current.due,
        done: nextDone,
        createdAt,
        completedAt,
        timeSpentSeconds: finalTimeSpent,
        contemplationTag:
          updates.contemplationTag !== undefined ? updates.contemplationTag : current.contemplationTag ?? null,
      };
      return {
        ...prev,
        [taskId]: next,
      };
    });
  }, []);

  const addTask = useCallback((task: {
    title: string;
    due: string | null;
    quadrant: Quadrant;
    contemplationTag?: ContemplationTag | null;
    capturedViaContemplation?: boolean;
  }) => {
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
          createdAt: new Date().toISOString(),
          completedAt: null,
          timeSpentSeconds: 0,
          contemplationTag: task.contemplationTag ?? null,
          capturedViaContemplation: task.capturedViaContemplation ?? false,
        },
      };
    });
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    setTasks((prev) => {
      if (!prev[taskId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  }, []);

  const addTimeToTask = useCallback((taskId: string, seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return;
    }
    setTasks((prev) => {
      const current = prev[taskId];
      if (!current) {
        return prev;
      }
      const nextTimeSpent = (current.timeSpentSeconds ?? 0) + seconds;
      return {
        ...prev,
        [taskId]: {
          ...current,
          timeSpentSeconds: nextTimeSpent,
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
    deleteTask,
    addTimeToTask,
    clearCorruptedState,
    loadError,
  };
}
