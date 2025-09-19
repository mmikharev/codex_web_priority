import { useMemo, useState } from 'react';
import { PomodoroConfig, PomodoroStats } from '../hooks/usePomodoroTimer';
import { Task } from '../types';
import styles from './PomodoroBar.module.css';

type PomodoroMode = 'focus' | 'short_break' | 'long_break' | 'idle';
type RunState = 'running' | 'paused' | 'stopped';

interface PomodoroBarProps {
  activeTask: Task | null;
  mode: PomodoroMode;
  runState: RunState;
  remainingSeconds: number;
  config: PomodoroConfig;
  stats: PomodoroStats;
  focusModeEnabled: boolean;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onSkip: () => void;
  onToggleFocusMode: () => void;
  onUpdateConfig: (partial: Partial<PomodoroConfig>) => void;
  onClearStats: () => void;
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function getModeMeta(mode: PomodoroMode) {
  switch (mode) {
    case 'focus':
      return { label: 'Работа', className: styles.modeFocus };
    case 'short_break':
      return { label: 'Короткий отдых', className: styles.modeShort };
    case 'long_break':
      return { label: 'Длинный отдых', className: styles.modeLong };
    default:
      return { label: 'Не запущен', className: styles.modeIdle };
  }
}

function useStats(stats: PomodoroStats) {
  return useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let weekly = 0;
    let monthly = 0;

    for (const iso of stats.history) {
      const timestamp = new Date(iso);
      if (Number.isNaN(timestamp.getTime())) {
        continue;
      }
      if (timestamp >= weekStart) {
        weekly += 1;
      }
      if (timestamp >= monthStart) {
        monthly += 1;
      }
    }

    return { weekly, monthly };
  }, [stats.history]);
}

export function PomodoroBar({
  activeTask,
  mode,
  runState,
  remainingSeconds,
  config,
  stats,
  focusModeEnabled,
  onPause,
  onResume,
  onReset,
  onSkip,
  onToggleFocusMode,
  onUpdateConfig,
  onClearStats,
}: PomodoroBarProps) {
  const [showSettings, setShowSettings] = useState(false);
  const modeMeta = getModeMeta(mode);
  const progressBase =
    mode === 'focus'
      ? config.focusMinutes * 60
      : mode === 'short_break'
      ? config.shortBreakMinutes * 60
      : mode === 'long_break'
      ? config.longBreakMinutes * 60
      : config.focusMinutes * 60;
  const progress = progressBase ? 1 - remainingSeconds / progressBase : 0;
  const statsSummary = useStats(stats);
  const totalPomodoros = Object.values(stats.completedPerTask).reduce((acc, value) => acc + value, 0);

  return (
    <section className={styles.bar}>
      <div className={styles.main}>
        <div className={styles.timerInfo}>
          <div className={`${styles.modeBadge} ${modeMeta.className}`.trim()}>{modeMeta.label}</div>
          <div className={styles.time}>{formatTime(remainingSeconds)}</div>
          <div className={styles.progressWrapper}>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} />
            </div>
            <div className={styles.taskName}>{activeTask ? activeTask.title : 'Задача не выбрана'}</div>
          </div>
        </div>
        <div className={styles.controls}>
          {runState === 'running' ? (
            <button type="button" className={styles.controlButton} onClick={onPause}>
              Пауза (P)
            </button>
          ) : (
            <button type="button" className={styles.controlButton} onClick={onResume} disabled={!activeTask}>
              Старт (P)
            </button>
          )}
          <button type="button" className={styles.controlButton} onClick={onSkip} disabled={mode === 'idle'}>
            Следующий
          </button>
          <button type="button" className={styles.controlButton} onClick={onReset}>
            Сброс (R)
          </button>
          <button
            type="button"
            className={`${styles.controlButton} ${focusModeEnabled ? styles.controlActive : ''}`.trim()}
            onClick={onToggleFocusMode}
          >
            Фокус-режим
          </button>
          <button type="button" className={styles.settingsToggle} onClick={() => setShowSettings((value) => !value)}>
            Настройки
          </button>
        </div>
      </div>
      <div className={styles.bottomRow}>
        <div className={styles.statBox}>
          <span className={styles.statLabel}>В неделю</span>
          <span className={styles.statValue}>{statsSummary.weekly}</span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.statLabel}>В месяц</span>
          <span className={styles.statValue}>{statsSummary.monthly}</span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.statLabel}>Всего</span>
          <span className={styles.statValue}>{totalPomodoros}</span>
        </div>
      </div>
      {showSettings ? (
        <div className={styles.settingsPanel}>
          <div className={styles.settingsGrid}>
            <label className={styles.settingsField}>
              Работа (мин)
              <input
                type="number"
                min={1}
                max={180}
                value={config.focusMinutes}
                onChange={(event) => onUpdateConfig({ focusMinutes: Number(event.target.value) || config.focusMinutes })}
              />
            </label>
            <label className={styles.settingsField}>
              Короткий отдых (мин)
              <input
                type="number"
                min={1}
                max={60}
                value={config.shortBreakMinutes}
                onChange={(event) =>
                  onUpdateConfig({ shortBreakMinutes: Number(event.target.value) || config.shortBreakMinutes })
                }
              />
            </label>
            <label className={styles.settingsField}>
              Длинный отдых (мин)
              <input
                type="number"
                min={1}
                max={120}
                value={config.longBreakMinutes}
                onChange={(event) =>
                  onUpdateConfig({ longBreakMinutes: Number(event.target.value) || config.longBreakMinutes })
                }
              />
            </label>
            <label className={styles.settingsField}>
              Через сколько циклов длинный отдых
              <input
                type="number"
                min={1}
                max={8}
                value={config.longBreakEvery}
                onChange={(event) =>
                  onUpdateConfig({ longBreakEvery: Number(event.target.value) || config.longBreakEvery })
                }
              />
            </label>
          </div>
          <div className={styles.settingsToggles}>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={config.autoTransition}
                onChange={(event) => onUpdateConfig({ autoTransition: event.target.checked })}
              />
              Автоматический переход между режимами
            </label>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={config.enableLongBreak}
                onChange={(event) => onUpdateConfig({ enableLongBreak: event.target.checked })}
              />
              Длинный отдых после цикла
            </label>
            <button type="button" className={styles.clearStats} onClick={onClearStats}>
              Сбросить статистику
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
