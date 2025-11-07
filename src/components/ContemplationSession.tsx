import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ContemplationTag } from '../types';
import { CONTEMPLATION_TAGS, pickNextHint } from '../utils/contemplation';
import styles from './ContemplationSession.module.css';

const DEFAULT_VOID_SECONDS = 45;
const ENTRIES_BEFORE_VOID = 3;

interface ContemplationSessionProps {
  open: boolean;
  durationMinutes: number;
  onDurationChange: (minutes: number) => void;
  onClose: () => void;
  onCreateTask: (input: { title: string; tag?: ContemplationTag | null }) => void;
}

function clampDuration(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(30, Math.max(1, Math.round(value)));
}

function formatTime(value: number): string {
  const minutes = Math.floor(Math.max(0, value) / 60);
  const seconds = Math.max(0, value) % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function ContemplationSession({
  open,
  durationMinutes,
  onDurationChange,
  onClose,
  onCreateTask,
}: ContemplationSessionProps) {
  const [inputValue, setInputValue] = useState('');
  const [selectedTag, setSelectedTag] = useState<ContemplationTag | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(durationMinutes * 60);
  const [voidRemainingSeconds, setVoidRemainingSeconds] = useState(DEFAULT_VOID_SECONDS);
  const [isVoidPhase, setVoidPhase] = useState(false);
  const [entriesSincePause, setEntriesSincePause] = useState(0);
  const [hint, setHint] = useState(() => pickNextHint());
  const [recentCapture, setRecentCapture] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setInputValue('');
    setSelectedTag(null);
    setRemainingSeconds(durationMinutes * 60);
    setVoidRemainingSeconds(DEFAULT_VOID_SECONDS);
    setVoidPhase(false);
    setEntriesSincePause(0);
    setHint((current) => pickNextHint(current));
    setRecentCapture(null);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [open, durationMinutes]);

  useEffect(() => {
    if (!open || isVoidPhase) {
      return;
    }
    const timerId = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [open, isVoidPhase]);

  useEffect(() => {
    if (!open || !isVoidPhase) {
      return;
    }
    const timerId = window.setInterval(() => {
      setVoidRemainingSeconds((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [open, isVoidPhase]);

  useEffect(() => {
    if (!open || isVoidPhase) {
      return;
    }
    if (remainingSeconds <= 0) {
      onClose();
    }
  }, [remainingSeconds, open, isVoidPhase, onClose]);

  useEffect(() => {
    if (!open || !isVoidPhase) {
      return;
    }
    if (voidRemainingSeconds <= 0) {
      setVoidPhase(false);
      setVoidRemainingSeconds(DEFAULT_VOID_SECONDS);
      setEntriesSincePause(0);
      setHint((current) => pickNextHint(current));
      setRemainingSeconds(durationMinutes * 60);
      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [open, isVoidPhase, voidRemainingSeconds, durationMinutes]);

  useEffect(() => {
    if (!open || isVoidPhase) {
      return;
    }
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [isVoidPhase, open]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = inputValue.trim();
    if (!normalized) {
      return;
    }
    onCreateTask({ title: normalized, tag: selectedTag });
    setRecentCapture(normalized);
    setInputValue('');
    setSelectedTag(null);
    setRemainingSeconds(durationMinutes * 60);
    setEntriesSincePause((previous) => previous + 1);
    setHint((current) => pickNextHint(current));
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    if (entriesSincePause > 0 && entriesSincePause % ENTRIES_BEFORE_VOID === 0 && !isVoidPhase) {
      setVoidPhase(true);
      setVoidRemainingSeconds(DEFAULT_VOID_SECONDS);
    }
  }, [entriesSincePause, isVoidPhase, open]);

  const handleDurationInputChange = (event: FormEvent<HTMLInputElement>) => {
    const nextValue = clampDuration(Number((event.target as HTMLInputElement).value));
    onDurationChange(nextValue);
    setRemainingSeconds(nextValue * 60);
  };

  const formattedRemaining = useMemo(() => formatTime(remainingSeconds), [remainingSeconds]);
  const formattedVoid = useMemo(() => formatTime(voidRemainingSeconds), [voidRemainingSeconds]);

  if (!open) {
    return null;
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="contemplation-title">
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerText}>
            <h2 id="contemplation-title" className={styles.title}>
              Созерцание точки
            </h2>
            <p className={styles.hint} aria-live="polite">
              {hint}
            </p>
          </div>
          <div className={styles.controls}>
            <label className={styles.durationControl}>
              <span>Пауза завершится через</span>
              <input
                type="range"
                min={1}
                max={30}
                value={durationMinutes}
                onInput={handleDurationInputChange}
                aria-label="Длительность тишины"
              />
              <span className={styles.durationValue}>{durationMinutes} мин</span>
            </label>
            <button type="button" className={styles.closeButton} onClick={onClose}>
              Завершить сеанс
            </button>
          </div>
        </header>

        <div className={styles.timerRow}>
          <span className={styles.timerLabel}>Тишина до закрытия:</span>
          <span className={styles.timerValue}>{formattedRemaining}</span>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            placeholder={isVoidPhase ? 'Смотри на точку и дыши' : 'Выгружайте мысль и жмите Enter'}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
              }
            }}
            disabled={isVoidPhase}
            aria-disabled={isVoidPhase ? 'true' : 'false'}
          />
        </form>

        <div className={styles.tags}>
          {CONTEMPLATION_TAGS.map((tagDefinition) => {
            const isActive = selectedTag === tagDefinition.id;
            return (
              <button
                key={tagDefinition.id}
                type="button"
                className={`${styles.tagButton} ${isActive ? styles.tagButtonActive : ''}`.trim()}
                onClick={() => setSelectedTag(isActive ? null : tagDefinition.id)}
              >
                <span className={styles.tagTone}>{tagDefinition.tone === 'energy' ? 'Энергия' : 'Настроение'}</span>
                <span className={styles.tagLabel}>{tagDefinition.label}</span>
              </button>
            );
          })}
        </div>

        {recentCapture ? (
          <div className={styles.feedback} aria-live="polite">
            Зафиксировано: «{recentCapture}»
          </div>
        ) : null}

        {isVoidPhase ? (
          <div className={styles.voidBlock}>
            <div className={styles.voidDot} aria-hidden="true" />
            <p className={styles.voidTimer}>{formattedVoid}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
