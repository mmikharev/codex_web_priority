import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ImportSummary } from './useTaskStore';
import { useTaskStore } from './useTaskStore';

describe('useTaskStore', () => {
  it('imports tasks into backlog', async () => {
    const { result } = renderHook(() => useTaskStore());

    let summary: ImportSummary | undefined;
    await act(async () => {
      summary = await result.current.importTasks(
        JSON.stringify({
          TaskA: '1. 10. 2025 at 0:00',
          TaskB: '',
        }),
      );
    });

    expect(summary?.added).toBe(2);
    expect(result.current.quadrants.backlog).toHaveLength(2);
  });

  it('preserves quadrant on re-import', async () => {
    const { result } = renderHook(() => useTaskStore());
    await act(async () => result.current.importTasks(JSON.stringify({ TaskA: '' })));
    await act(async () => result.current.moveTask('TaskA', 'Q1'));
    await act(async () => result.current.importTasks(JSON.stringify({ TaskA: '2. 10. 2025 at 0:00' })));

    expect(result.current.tasks.TaskA.quadrant).toBe('Q1');
    expect(result.current.tasks.TaskA.due).toBe('2. 10. 2025 at 0:00');
  });

  it('moves everything to backlog when reset flag is provided', async () => {
    const { result } = renderHook(() => useTaskStore());

    await act(async () =>
      result.current.importTasks(
        JSON.stringify({
          TaskA: '',
          TaskB: '',
        }),
      ),
    );

    await act(async () => result.current.moveTask('TaskA', 'Q3'));

    await act(async () =>
      result.current.importTasks(
        JSON.stringify({
          TaskA: '',
          TaskB: '',
        }),
        { resetQuadrants: true },
      ),
    );

    expect(result.current.tasks.TaskA.quadrant).toBe('backlog');
    expect(result.current.tasks.TaskB.quadrant).toBe('backlog');
  });

  it('accepts trailing commas in import JSON', async () => {
    const { result } = renderHook(() => useTaskStore());

    let summary: ImportSummary | undefined;
    await act(async () => {
      summary = await result.current.importTasks(`{
        "TaskA": "1. 10. 2025 at 0:00",
        "TaskB": "",
      }`);
    });

    expect(summary?.added).toBe(2);
    expect(result.current.tasks.TaskA.due).toBe('1. 10. 2025 at 0:00');
  });

  it('normalises due dates via updateTask', () => {
    const { result } = renderHook(() => useTaskStore());

    act(() => result.current.importTasks(JSON.stringify({ TaskA: '' })));
    act(() => result.current.updateTask('TaskA', { due: '   ' }));

    expect(result.current.tasks.TaskA.due).toBeNull();
  });
});
