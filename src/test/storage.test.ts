import { beforeEach, describe, expect, it } from 'vitest';
import { loadState, saveState } from '../utils/storage';
import type { TaskMap } from '../types';

const STORAGE_KEY = 'eisenhower_state_v1';
const BACKUP_KEY = `${STORAGE_KEY}_backup_v1`;

describe('storage migration', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('migrates version 1 payload to version 2 with done flag', () => {
    const legacyPayload = {
      version: 1,
      tasks: {
        foo: { id: 'foo', title: 'Foo task', quadrant: 'Q2' },
      },
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyPayload));

    const { tasks, error } = loadState();
    expect(error).toBeUndefined();
    expect(tasks.foo).toMatchObject({
      id: 'foo',
      title: 'Foo task',
      quadrant: 'Q2',
      done: false,
    });
    expect(window.localStorage.getItem(BACKUP_KEY)).toBe(JSON.stringify(legacyPayload));
  });

  it('wraps raw task map payload without version', () => {
    const rawMap = {
      foo: { id: 'foo', title: 'Foo', quadrant: 'Q3' },
    } satisfies TaskMap;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rawMap));

    const { tasks } = loadState();
    expect(tasks.foo).toMatchObject({
      id: 'foo',
      title: 'Foo',
      quadrant: 'Q3',
      done: false,
    });
    expect(window.localStorage.getItem(BACKUP_KEY)).toBe(JSON.stringify(rawMap));
  });

  it('persists latest payload version on save', () => {
    const tasks: TaskMap = {
      foo: { id: 'foo', title: 'Foo', quadrant: 'Q1', done: true },
    };

    saveState(tasks);

    const stored = window.localStorage.getItem(STORAGE_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(String(stored));
    expect(parsed).toMatchObject({ version: 3, tasks: { foo: { done: true } } });
  });
});
