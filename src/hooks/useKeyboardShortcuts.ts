import { RefObject, useEffect } from 'react';
import { Quadrant } from '../types';

type RunState = 'running' | 'paused' | 'stopped';

interface PomodoroShortcutControls {
  activeTaskId: string | null;
  runState: RunState;
  pause: () => void;
  resume: () => void;
  reset: () => void;
}

interface KeyboardShortcutOptions {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  setSearchExpanded: (value: boolean) => void;
  searchInputRef: RefObject<HTMLInputElement>;
  openImportModal: () => void;
  importTextareaRef: RefObject<HTMLTextAreaElement>;
  pomodoro: PomodoroShortcutControls;
  moveTask: (taskId: string, quadrant: Quadrant) => void;
  onResetFocusMode: () => void;
}

export function useKeyboardShortcuts({
  searchQuery,
  setSearchQuery,
  setSearchExpanded,
  searchInputRef,
  openImportModal,
  importTextareaRef,
  pomodoro,
  moveTask,
  onResetFocusMode,
}: KeyboardShortcutOptions) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      const normalizedKey = key.toLowerCase();
      const target = event.target as HTMLElement | null;
      const isEditableTarget =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (event.metaKey || event.ctrlKey || event.altKey) {
        if (normalizedKey === 'escape' && searchQuery) {
          event.preventDefault();
          setSearchQuery('');
          setSearchExpanded(false);
        }
        return;
      }

      if (normalizedKey === '/') {
        event.preventDefault();
        setSearchExpanded(true);
        window.requestAnimationFrame(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        });
        return;
      }

      if (normalizedKey === 'escape') {
        if (searchQuery) {
          event.preventDefault();
          setSearchQuery('');
          setSearchExpanded(false);
        }
        return;
      }

      if (isEditableTarget) {
        return;
      }

      if (normalizedKey === 'p') {
        event.preventDefault();
        if (pomodoro.runState === 'running') {
          pomodoro.pause();
        } else if (pomodoro.activeTaskId) {
          pomodoro.resume();
        }
        return;
      }

      if (normalizedKey === 'r') {
        event.preventDefault();
        pomodoro.reset();
        onResetFocusMode();
        return;
      }

      if (normalizedKey === 'i') {
        event.preventDefault();
        openImportModal();
        window.requestAnimationFrame(() => {
          const textarea = importTextareaRef.current;
          textarea?.focus();
          textarea?.select?.();
        });
        return;
      }

      if (['0', '1', '2', '3', '4'].includes(key)) {
        const activeElement = document.activeElement as HTMLElement | null;
        const taskId = activeElement?.dataset.taskId;
        if (!taskId) {
          return;
        }

        const targetQuadrant: Quadrant =
          key === '0' ? 'backlog' : key === '1' ? 'Q1' : key === '2' ? 'Q2' : key === '3' ? 'Q3' : 'Q4';

        event.preventDefault();
        moveTask(taskId, targetQuadrant);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    importTextareaRef,
    moveTask,
    onResetFocusMode,
    openImportModal,
    pomodoro.activeTaskId,
    pomodoro.pause,
    pomodoro.reset,
    pomodoro.resume,
    pomodoro.runState,
    searchInputRef,
    searchQuery,
    setSearchExpanded,
    setSearchQuery,
  ]);
}
