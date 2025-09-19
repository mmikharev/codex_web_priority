import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

type ShortcutProps = Parameters<typeof useKeyboardShortcuts>[0];

describe('useKeyboardShortcuts', () => {
  let originalRaf: typeof window.requestAnimationFrame;

  beforeEach(() => {
    originalRaf = window.requestAnimationFrame;
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    }) as typeof window.requestAnimationFrame;
  });

  afterEach(() => {
    window.requestAnimationFrame = originalRaf;
    document.body.innerHTML = '';
  });

  it('focuses search input on / and clears query on escape', () => {
    const searchInput = document.createElement('input');
    document.body.appendChild(searchInput);
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    const setSearchQuery = vi.fn();
    const setSearchExpanded = vi.fn();
    const openImportModal = vi.fn();
    const moveTask = vi.fn();
    const pause = vi.fn();
    const resume = vi.fn();
    const reset = vi.fn();
    const onResetFocusMode = vi.fn();

    const initialProps: ShortcutProps = {
      searchQuery: '',
      setSearchQuery,
      setSearchExpanded,
      searchInputRef: { current: searchInput },
      openImportModal,
      importTextareaRef: { current: textarea },
      pomodoro: { activeTaskId: 'task-1', runState: 'paused' as const, pause, resume, reset },
      moveTask,
      onResetFocusMode,
    };

    const { rerender } = renderHook((props: ShortcutProps) => useKeyboardShortcuts(props), { initialProps });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }));
    });

    expect(setSearchExpanded).toHaveBeenCalledWith(true);
    expect(document.activeElement).toBe(searchInput);

    rerender({ ...initialProps, searchQuery: 'foo' });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(setSearchQuery).toHaveBeenCalledWith('');
    expect(setSearchExpanded).toHaveBeenCalledWith(false);
  });

  it('controls pomodoro playback with p and r', () => {
    const searchInput = document.createElement('input');
    document.body.appendChild(searchInput);
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    const pause = vi.fn();
    const resume = vi.fn();
    const reset = vi.fn();
    const setSearchQuery = vi.fn();
    const setSearchExpanded = vi.fn();
    const moveTask = vi.fn();
    const onResetFocusMode = vi.fn();
    const openImportModal = vi.fn();

    const { rerender } = renderHook((props: ShortcutProps) => useKeyboardShortcuts(props), {
      initialProps: {
        searchQuery: '',
        setSearchQuery,
        setSearchExpanded,
        searchInputRef: { current: searchInput },
        openImportModal,
        importTextareaRef: { current: textarea },
        pomodoro: { activeTaskId: 'task-1', runState: 'running', pause, resume, reset },
        moveTask,
        onResetFocusMode,
      },
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }));
    });

    expect(pause).toHaveBeenCalledTimes(1);

    rerender({
      searchQuery: '',
      setSearchQuery,
      setSearchExpanded,
      searchInputRef: { current: searchInput },
      openImportModal,
      importTextareaRef: { current: textarea },
      pomodoro: { activeTaskId: 'task-1', runState: 'paused', pause, resume, reset },
      moveTask,
      onResetFocusMode,
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }));
    });

    expect(resume).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
    });

    expect(reset).toHaveBeenCalledTimes(1);
    expect(onResetFocusMode).toHaveBeenCalledTimes(1);
  });

  it('opens import modal and moves tasks with digit keys', () => {
    const searchInput = document.createElement('input');
    document.body.appendChild(searchInput);
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    const focusButton = document.createElement('button');
    focusButton.dataset.taskId = 'task-42';
    document.body.appendChild(focusButton);
    focusButton.focus();

    const pause = vi.fn();
    const resume = vi.fn();
    const reset = vi.fn();
    const setSearchQuery = vi.fn();
    const setSearchExpanded = vi.fn();
    const moveTask = vi.fn();
    const onResetFocusMode = vi.fn();
    const openImportModal = vi.fn();

    renderHook((props: ShortcutProps) => useKeyboardShortcuts(props), {
      initialProps: {
        searchQuery: '',
        setSearchQuery,
        setSearchExpanded,
        searchInputRef: { current: searchInput },
        openImportModal,
        importTextareaRef: { current: textarea },
        pomodoro: { activeTaskId: null, runState: 'stopped', pause, resume, reset },
        moveTask,
        onResetFocusMode,
      },
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'i' }));
    });

    expect(openImportModal).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(textarea);

    focusButton.focus();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
    });

    expect(moveTask).toHaveBeenCalledWith('task-42', 'Q1');
  });
});
