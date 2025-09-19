import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type PomodoroMode = 'focus' | 'short_break' | 'long_break' | 'idle';
type RunState = 'running' | 'paused' | 'stopped';

export interface PomodoroConfig {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakEvery: number;
  autoTransition: boolean;
  enableLongBreak: boolean;
}

export interface PomodoroStats {
  completedPerTask: Record<string, number>;
  history: string[];
}

interface PomodoroState {
  activeTaskId: string | null;
  mode: PomodoroMode;
  runState: RunState;
  remainingSeconds: number;
  streak: number;
  config: PomodoroConfig;
  stats: PomodoroStats;
}

const DEFAULT_CONFIG: PomodoroConfig = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
  autoTransition: true,
  enableLongBreak: true,
};

const STORAGE_KEY = 'eisenhower-pomodoro-state-v1';

function loadState(): PomodoroState {
  if (typeof window === 'undefined') {
    return {
      activeTaskId: null,
      mode: 'idle',
      runState: 'stopped',
      remainingSeconds: DEFAULT_CONFIG.focusMinutes * 60,
      streak: 0,
      config: DEFAULT_CONFIG,
      stats: { completedPerTask: {}, history: [] },
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error('No state');
    const parsed = JSON.parse(raw) as Partial<PomodoroState>;
    return {
      activeTaskId: parsed.activeTaskId ?? null,
      mode: parsed.mode === 'focus' || parsed.mode === 'short_break' || parsed.mode === 'long_break' ? parsed.mode : 'idle',
      runState: parsed.runState === 'running' || parsed.runState === 'paused' ? parsed.runState : 'stopped',
      remainingSeconds: typeof parsed.remainingSeconds === 'number' ? parsed.remainingSeconds : DEFAULT_CONFIG.focusMinutes * 60,
      streak: typeof parsed.streak === 'number' ? parsed.streak : 0,
      config: {
        focusMinutes: parsed.config?.focusMinutes ?? DEFAULT_CONFIG.focusMinutes,
        shortBreakMinutes: parsed.config?.shortBreakMinutes ?? DEFAULT_CONFIG.shortBreakMinutes,
        longBreakMinutes: parsed.config?.longBreakMinutes ?? DEFAULT_CONFIG.longBreakMinutes,
        longBreakEvery: parsed.config?.longBreakEvery ?? DEFAULT_CONFIG.longBreakEvery,
        autoTransition: parsed.config?.autoTransition ?? DEFAULT_CONFIG.autoTransition,
        enableLongBreak: parsed.config?.enableLongBreak ?? DEFAULT_CONFIG.enableLongBreak,
      },
      stats: {
        completedPerTask: parsed.stats?.completedPerTask ?? {},
        history: parsed.stats?.history ?? [],
      },
    };
  } catch (error) {
    console.warn('Failed to load pomodoro state', error);
    return {
      activeTaskId: null,
      mode: 'idle',
      runState: 'stopped',
      remainingSeconds: DEFAULT_CONFIG.focusMinutes * 60,
      streak: 0,
      config: DEFAULT_CONFIG,
      stats: { completedPerTask: {}, history: [] },
    };
  }
}

function getDurationSeconds(config: PomodoroConfig, mode: PomodoroMode): number {
  if (mode === 'focus') return config.focusMinutes * 60;
  if (mode === 'short_break') return config.shortBreakMinutes * 60;
  if (mode === 'long_break') return config.longBreakMinutes * 60;
  return config.focusMinutes * 60;
}

export function usePomodoroTimer() {
  const [{ activeTaskId, mode, runState, remainingSeconds, streak, config, stats }, setState] = useState<PomodoroState>(() =>
    loadState(),
  );
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const payload: PomodoroState = {
      activeTaskId,
      mode,
      runState,
      remainingSeconds,
      streak,
      config,
      stats,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [activeTaskId, mode, runState, remainingSeconds, streak, config, stats]);

  const clearIntervalRef = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const scheduleTick = useCallback(() => {
    clearIntervalRef();
    intervalRef.current = window.setInterval(() => {
      setState((prev) => {
        if (prev.runState !== 'running') {
          return prev;
        }
        const nextRemaining = Math.max(0, prev.remainingSeconds - 1);
        if (nextRemaining > 0) {
          return { ...prev, remainingSeconds: nextRemaining };
        }

        const nowIso = new Date().toISOString();
        const nextStats: PomodoroStats = {
          completedPerTask: { ...prev.stats.completedPerTask },
          history: prev.stats.history.slice(-200),
        };

        if (prev.mode === 'focus' && prev.activeTaskId) {
          nextStats.completedPerTask[prev.activeTaskId] = (nextStats.completedPerTask[prev.activeTaskId] ?? 0) + 1;
          nextStats.history = [...nextStats.history, nowIso];
        }

        const isFocus = prev.mode === 'focus';
        const nextStreak = isFocus ? prev.streak + 1 : prev.streak;
        const shouldLongBreak =
          prev.config.enableLongBreak && isFocus && nextStreak % prev.config.longBreakEvery === 0;
        const nextMode: PomodoroMode =
          prev.mode === 'focus'
            ? shouldLongBreak
              ? 'long_break'
              : 'short_break'
            : prev.activeTaskId
            ? 'focus'
            : 'idle';

        const nextRemainingSeconds = getDurationSeconds(prev.config, nextMode);
        const shouldContinue = prev.config.autoTransition && nextMode !== 'idle';

        if (!shouldContinue) {
          clearIntervalRef();
        }

        if (nextMode === 'idle') {
          return {
            ...prev,
            mode: 'idle',
            runState: 'stopped',
            remainingSeconds: getDurationSeconds(prev.config, 'focus'),
            stats: nextStats,
            streak: nextMode === 'idle' ? 0 : nextStreak,
          };
        }

        return {
          ...prev,
          mode: nextMode,
          runState: shouldContinue ? 'running' : 'paused',
          remainingSeconds: nextRemainingSeconds,
          stats: nextStats,
          streak: nextMode === 'focus' ? nextStreak : prev.streak,
        };
      });
    }, 1000);
  }, [clearIntervalRef]);

  useEffect(() => {
    if (runState === 'running') {
      scheduleTick();
    } else {
      clearIntervalRef();
    }

    return clearIntervalRef;
  }, [runState, scheduleTick, clearIntervalRef]);

  const start = useCallback(
    (taskId: string) => {
      setState((prev) => ({
        ...prev,
        activeTaskId: taskId,
        mode: 'focus',
        runState: 'running',
        remainingSeconds: getDurationSeconds(prev.config, 'focus'),
      }));
    },
    [],
  );

  const pause = useCallback(() => {
    setState((prev) => ({ ...prev, runState: 'paused' }));
  }, []);

  const resume = useCallback(() => {
    setState((prev) => ({ ...prev, runState: 'running' }));
  }, []);

  const reset = useCallback(() => {
    setState((prev) => ({
      ...prev,
      runState: 'stopped',
      mode: 'idle',
      remainingSeconds: getDurationSeconds(prev.config, 'focus'),
      streak: 0,
      activeTaskId: null,
    }));
  }, []);

  const skip = useCallback(() => {
    setState((prev) => {
      if (prev.mode === 'idle') {
        return prev;
      }
      const nextMode: PomodoroMode =
        prev.mode === 'focus'
          ? prev.config.enableLongBreak && (prev.streak + 1) % prev.config.longBreakEvery === 0
            ? 'long_break'
            : 'short_break'
          : prev.activeTaskId
          ? 'focus'
          : 'idle';

      return {
        ...prev,
        mode: nextMode,
        runState: nextMode === 'idle' ? 'stopped' : prev.config.autoTransition ? 'running' : 'paused',
        remainingSeconds: getDurationSeconds(prev.config, nextMode === 'idle' ? 'focus' : nextMode),
      };
    });
  }, []);

  const updateConfig = useCallback((partial: Partial<PomodoroConfig>) => {
    setState((prev) => {
      const nextConfig: PomodoroConfig = { ...prev.config, ...partial };
      const nextRemaining = getDurationSeconds(nextConfig, prev.mode === 'idle' ? 'focus' : prev.mode);
      return {
        ...prev,
        config: nextConfig,
        remainingSeconds: prev.runState === 'stopped' ? nextRemaining : prev.remainingSeconds,
      };
    });
  }, []);

  const clearStats = useCallback(() => {
    setState((prev) => ({
      ...prev,
      stats: { completedPerTask: {}, history: [] },
    }));
  }, []);

  const value = useMemo(
    () => ({
      activeTaskId,
      mode,
      runState,
      remainingSeconds,
      streak,
      config,
      stats,
      start,
      pause,
      resume,
      reset,
      skip,
      updateConfig,
      clearStats,
    }),
    [activeTaskId, mode, runState, remainingSeconds, streak, config, stats, start, pause, resume, reset, skip, updateConfig, clearStats],
  );

  return value;
}
