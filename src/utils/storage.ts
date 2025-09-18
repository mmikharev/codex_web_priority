import { TaskMap } from '../types';

const STORAGE_KEY = 'eisenhower_state_v1';
const CURRENT_VERSION = 1;

interface PersistedState {
  version: number;
  tasks: TaskMap;
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

    if (parsed.version !== CURRENT_VERSION) {
      throw new Error('Unsupported storage version');
    }

    return { tasks: parsed.tasks ?? {} };
  } catch (error) {
    return { tasks: {}, error: error instanceof Error ? error : new Error('Unknown storage error') };
  }
}

let persistHandle: number | undefined;

export function saveState(tasks: TaskMap) {
  if (typeof window === 'undefined') {
    return;
  }

  const payload: PersistedState = { version: CURRENT_VERSION, tasks };
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
