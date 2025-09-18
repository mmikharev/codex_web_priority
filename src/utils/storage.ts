import { Quadrant, Task, TaskMap } from '../types';
import { sanitizeNotesHtml } from './notes';

const STORAGE_KEY = 'eisenhower_state_v1';
const BACKUP_KEY = `${STORAGE_KEY}_backup_v1`;
const CURRENT_VERSION = 2;

interface PersistedStateV1 {
  version?: 1;
  tasks: Record<string, Omit<Task, 'done'>>;
}

interface PersistedStateV2 {
  version: 2;
  tasks: TaskMap;
}

type PersistedState = PersistedStateV1 | PersistedStateV2;

function withDoneFlag(tasks: Record<string, Omit<Task, 'done'> | Task | undefined>): TaskMap {
  const result: TaskMap = {};
  Object.entries(tasks ?? {}).forEach(([id, task]) => {
    if (!task) {
      return;
    }

    const { done, quadrant, ...rest } = task as Task & { quadrant?: Quadrant };
    const normalizedQuadrant: Quadrant = quadrant ?? 'backlog';

    const sanitizedNotes = sanitizeNotesHtml((task as Task).notes ?? null);

    result[id] = {
      id,
      title: rest.title ?? id,
      due: rest.due ?? null,
      quadrant: normalizedQuadrant,
      done: done ?? false,
    };

    if (sanitizedNotes) {
      result[id].notes = sanitizedNotes;
    }
  });
  return result;
}

function persistBackup(raw: string) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (!window.localStorage.getItem(BACKUP_KEY)) {
      window.localStorage.setItem(BACKUP_KEY, raw);
    }
  } catch (error) {
    console.warn('Failed to persist backup of legacy state', error);
  }
}

export function loadState(): { tasks: TaskMap; error?: Error } {
  if (typeof window === 'undefined') {
    return { tasks: {} };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { tasks: {} };
    }

    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Unexpected storage payload');
    }

    if ('version' in parsed) {
      if (parsed.version === 2) {
        return { tasks: withDoneFlag(parsed.tasks) };
      }

      if (parsed.version === 1 || parsed.version === undefined) {
        persistBackup(raw);
        return { tasks: withDoneFlag(parsed.tasks) };
      }

      throw new Error('Unsupported storage version');
    }

    // Legacy payload without version field assumed to be TaskMap
    if ('tasks' in parsed && typeof parsed.tasks === 'object') {
      persistBackup(raw);
      return { tasks: withDoneFlag(parsed.tasks as Record<string, Task>) };
    }

    // Entire object is assumed to be the raw TaskMap.
    persistBackup(raw);
    return { tasks: withDoneFlag(parsed as unknown as Record<string, Task>) };
  } catch (error) {
    return { tasks: {}, error: error instanceof Error ? error : new Error('Unknown storage error') };
  }
}

let persistHandle: number | undefined;

export function saveState(tasks: TaskMap) {
  if (typeof window === 'undefined') {
    return;
  }

  const payload: PersistedStateV2 = { version: CURRENT_VERSION, tasks };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function scheduleSave(tasks: TaskMap, delay = 200) {
  if (typeof window === 'undefined') {
    return;
  }

  if (persistHandle) {
    window.clearTimeout(persistHandle);
  }

  persistHandle = window.setTimeout(() => {
    saveState(tasks);
  }, delay);
}

export function clearState() {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(STORAGE_KEY);
}
