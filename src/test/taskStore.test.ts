import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTaskStore } from '../hooks/useTaskStore';
import { createExportPayload } from '../utils/export';

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
});

afterEach(() => {
  vi.runAllTimers();
  vi.useRealTimers();
});

describe('useTaskStore importTasks', () => {
  it('imports structured export payload preserving metadata', () => {
    const { result } = renderHook(() => useTaskStore());

    const payload = {
      version: 2,
      exportedAt: '2024-01-01T00:00:00.000Z',
      tasks: {
        foo: { title: 'Foo', due: '1. 10. 2025 at 0:00', quadrant: 'Q2', done: true },
      },
    };

    act(() => {
      const summary = result.current.importTasks(JSON.stringify(payload), { resetQuadrants: false });
      expect(summary).toMatchObject({ added: 1, updated: 0, total: 1 });
    });

    const task = result.current.tasks.foo;
    expect(task).toBeDefined();
    expect(task).toMatchObject({
      id: 'foo',
      title: 'Foo',
      due: '1. 10. 2025 at 0:00',
      quadrant: 'Q2',
      done: true,
    });
  });

  it('supports legacy flat map import and resets quadrants when requested', () => {
    const { result } = renderHook(() => useTaskStore());

    act(() => {
      result.current.importTasks(JSON.stringify({ foo: '1. 10. 2025 at 0:00' }), { resetQuadrants: false });
      result.current.moveTask('foo', 'Q1');
      result.current.updateTask('foo', { title: 'Foo original' });
      result.current.importTasks(JSON.stringify({ foo: '' }), { resetQuadrants: true });
    });

    const task = result.current.tasks.foo;
    expect(task).toMatchObject({
      id: 'foo',
      title: 'foo',
      due: null,
      quadrant: 'backlog',
      done: false,
    });
  });

  it('imports quadrant-grouped maps into the correct categories', () => {
    const { result } = renderHook(() => useTaskStore());

    act(() => {
      const summary = result.current.importTasks(
        JSON.stringify({
          Q1: { urgent: '1. 10. 2025 at 0:00' },
          Q4: { relax: '' },
        }),
        { resetQuadrants: false },
      );
      expect(summary).toMatchObject({ added: 2, updated: 0, total: 2 });
    });

    expect(result.current.tasks.urgent).toMatchObject({
      quadrant: 'Q1',
      due: '1. 10. 2025 at 0:00',
    });
    expect(result.current.tasks.relax).toMatchObject({
      quadrant: 'Q4',
      due: null,
    });

    act(() => {
      const summary = result.current.importTasks(
        JSON.stringify({
          Q2: { urgent: '' },
        }),
        { resetQuadrants: false },
      );
      expect(summary).toMatchObject({ added: 0, updated: 1, total: 1 });
    });

    expect(result.current.tasks.urgent).toMatchObject({ quadrant: 'Q2', due: null });
  });

  it('restores state from exported payload without data loss', () => {
    const first = renderHook(() => useTaskStore());

    act(() => {
      first.result.current.importTasks(
        JSON.stringify({
          alpha: '1. 10. 2025 at 0:00',
          beta: '',
        }),
        { resetQuadrants: false },
      );
      first.result.current.updateTask('alpha', { title: 'Important alpha', done: true });
      first.result.current.moveTask('alpha', 'Q3');
      first.result.current.moveTask('beta', 'Q2');
    });

    const exportPayload = createExportPayload(first.result.current.tasks, new Date('2024-01-01T00:00:00Z'));
    const exportJson = JSON.stringify(exportPayload);

    const second = renderHook(() => useTaskStore());

    act(() => {
      second.result.current.importTasks(exportJson, { resetQuadrants: false });
    });

    expect(second.result.current.tasks).toEqual(first.result.current.tasks);
  });

  it('sanitizes trailing commas without altering string contents', () => {
    const { result } = renderHook(() => useTaskStore());

    const json = `{
      "tasks": {
        "hello": {
          "title": "Hello, ] world",
          "quadrant": "Q1",
          "due": "2024-01-01T00:00:00.000Z",
        },
      },
    }`;

    act(() => {
      const summary = result.current.importTasks(json);
      expect(summary).toMatchObject({ added: 1, updated: 0, total: 1 });
    });

    expect(result.current.tasks.hello.title).toBe('Hello, ] world');
    expect(result.current.tasks.hello.quadrant).toBe('Q1');
  });

  it('keeps existing metadata when fields are missing in import payload', () => {
    const { result } = renderHook(() => useTaskStore());

    act(() => {
      result.current.importTasks(JSON.stringify({ foo: '2024-01-01T00:00:00.000Z' }));
      result.current.updateTask('foo', { title: 'Custom title', done: true });
      result.current.moveTask('foo', 'Q3');
      result.current.addTimeToTask('foo', 300);
    });

    const payload = {
      tasks: {
        foo: {
          due: '2024-02-02T00:00:00.000Z',
        },
      },
    };

    act(() => {
      const summary = result.current.importTasks(JSON.stringify(payload));
      expect(summary).toMatchObject({ added: 0, updated: 1, total: 1 });
    });

    expect(result.current.tasks.foo).toMatchObject({
      title: 'Custom title',
      quadrant: 'Q3',
      done: true,
      timeSpentSeconds: 300,
      due: '2024-02-02T00:00:00.000Z',
    });
  });
});
