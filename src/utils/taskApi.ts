import { ContemplationTag, Quadrant, Task, TaskMap } from '../types';

type TaskCreateInput = {
  id?: string;
  title: string;
  due: string | null;
  quadrant: Quadrant;
  contemplationTag?: ContemplationTag | null;
  capturedViaContemplation?: boolean;
};

type TaskUpdateInput = Partial<
  Pick<
    Task,
    | 'title'
    | 'due'
    | 'quadrant'
    | 'done'
    | 'completedAt'
    | 'timeSpentSeconds'
    | 'contemplationTag'
    | 'capturedViaContemplation'
  >
>;

function resolveDefaultBaseUrl(): string {
  if (import.meta.env.VITE_API_BASE_URL) {
    return String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, '');
  }

  if (import.meta.env.DEV) {
    return 'http://localhost:4000/api';
  }

  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    if (window.location.protocol === 'file:') {
      return 'http://localhost:4000/api';
    }
    return `${window.location.origin.replace(/\/$/, '')}/api`;
  }

  return 'http://localhost:4000/api';
}

const DEFAULT_BASE_URL = resolveDefaultBaseUrl();

function getBaseUrl(): string {
  return DEFAULT_BASE_URL;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: HeadersInit = {
    Accept: 'application/json',
    ...(init?.headers ?? {}),
  };

  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...headers } : headers,
  });

  if (!response.ok) {
    let message = `Ошибка запроса (${response.status})`;
    try {
      const data = await response.json();
      if (data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string') {
        message = (data as { error: string }).error;
      }
    } catch {
      // ignore parsing errors
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('Content-Type') ?? '';
  if (!contentType.includes('application/json')) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function fetchTasks(): Promise<TaskMap> {
  const payload = await request<{ tasks: TaskMap }>('/tasks');
  if (!payload || typeof payload !== 'object' || !payload.tasks) {
    return {};
  }
  return payload.tasks;
}

export async function createTask(input: TaskCreateInput): Promise<Task> {
  const payload = await request<{ task: Task }>('/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return payload.task;
}

export async function updateTask(taskId: string, updates: TaskUpdateInput): Promise<Task> {
  const payload = await request<{ task: Task }>(`/tasks/${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return payload.task;
}

export async function deleteTask(taskId: string): Promise<void> {
  await request<void>(`/tasks/${encodeURIComponent(taskId)}`, {
    method: 'DELETE',
  });
}

export async function replaceAllTasks(tasks: TaskMap): Promise<TaskMap> {
  const payload = await request<{ tasks: TaskMap }>('/tasks', {
    method: 'PUT',
    body: JSON.stringify({ tasks }),
  });
  return payload.tasks;
}

export async function clearTasks(): Promise<void> {
  await request<void>('/tasks', { method: 'DELETE' });
}
