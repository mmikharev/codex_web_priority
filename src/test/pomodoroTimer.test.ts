import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePomodoroTimer } from '../hooks/usePomodoroTimer';

describe('usePomodoroTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('records completed session duration despite runtime config changes', () => {
    const { result } = renderHook(() => usePomodoroTimer());

    act(() => {
      result.current.updateConfig({ focusMinutes: 1, shortBreakMinutes: 1, longBreakMinutes: 1 });
    });

    act(() => {
      result.current.start('task-1');
    });

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    act(() => {
      result.current.updateConfig({ focusMinutes: 2 });
    });

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    const sessions = result.current.stats.completedSessions;
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      taskId: 'task-1',
      durationSeconds: 60,
    });
    expect(result.current.stats.completedPerTask['task-1']).toBe(1);
  });
});
