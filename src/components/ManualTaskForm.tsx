import {
  FormEvent,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Quadrant } from '../types';
import { fromDateTimeLocalInput } from '../utils/date';
import styles from './ManualTaskForm.module.css';

interface ManualTaskFormProps {
  onCreateTask: (task: { title: string; due: string | null; quadrant: Quadrant }) => void;
  initialQuadrant?: Quadrant;
  focusTrigger?: number;
}

const QUADRANT_OPTIONS: Array<{ value: Quadrant; label: string }> = [
  { value: 'backlog', label: 'Бэклог' },
  { value: 'Q1', label: 'Q1 — Срочно + Важно' },
  { value: 'Q2', label: 'Q2 — Несрочно + Важно' },
  { value: 'Q3', label: 'Q3 — Срочно + Неважно' },
  { value: 'Q4', label: 'Q4 — Несрочно + Неважно' },
];

export const ManualTaskForm = forwardRef<HTMLFormElement, ManualTaskFormProps>(
  ({ onCreateTask, initialQuadrant = 'backlog', focusTrigger }, ref) => {
    const [title, setTitle] = useState('');
    const [due, setDue] = useState('');
    const [quadrant, setQuadrant] = useState<Quadrant>(initialQuadrant);
    const [error, setError] = useState<string | null>(null);
    const [errorField, setErrorField] = useState<'title' | 'due' | null>(null);
    const [feedback, setFeedback] = useState<string | null>(null);
    const titleInputRef = useRef<HTMLInputElement>(null);
    const lastFocusTriggerRef = useRef<number | undefined>(undefined);
    const lastInitialQuadrantRef = useRef<Quadrant>(initialQuadrant);

    useEffect(() => {
      if (!feedback) {
        return;
      }
      const timeoutId = window.setTimeout(() => setFeedback(null), 2400);
      return () => window.clearTimeout(timeoutId);
    }, [feedback]);

    useEffect(() => {
      if (lastInitialQuadrantRef.current !== initialQuadrant) {
        lastInitialQuadrantRef.current = initialQuadrant;
        setQuadrant(initialQuadrant);
      }
    }, [initialQuadrant]);

    useEffect(() => {
      if (focusTrigger === undefined) {
        return;
      }
      if (lastFocusTriggerRef.current === focusTrigger) {
        return;
      }
      lastFocusTriggerRef.current = focusTrigger;
      setError(null);
      setErrorField(null);
      setFeedback(null);
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }, [focusTrigger]);

    const isSubmitDisabled = useMemo(() => !title.trim(), [title]);

    const resetForm = useCallback(() => {
      setTitle('');
      setDue('');
      setQuadrant(lastInitialQuadrantRef.current);
      setErrorField(null);
    }, []);

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const normalizedTitle = title.trim();
      if (!normalizedTitle) {
        setError('Введите название задачи');
        setErrorField('title');
        return;
      }

      const normalizedDue = due.trim();
      const dueIso = normalizedDue ? fromDateTimeLocalInput(normalizedDue) : null;
      if (normalizedDue && !dueIso) {
        setError('Выберите корректную дату и время');
        setErrorField('due');
        return;
      }

      setError(null);
      setErrorField(null);
      onCreateTask({ title: normalizedTitle, due: dueIso, quadrant });
      resetForm();
      setFeedback('Задача добавлена');
    };

    return (
      <form ref={ref} className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.header}>
          <h2 className={styles.title}>Быстрое добавление</h2>
          {feedback ? <span className={styles.feedback}>{feedback}</span> : null}
        </div>
        <label className={styles.label}>
          Название
          <input
            ref={titleInputRef}
            className={styles.input}
            value={title}
            onChange={(event) => {
              if (errorField === 'title') {
                setError(null);
                setErrorField(null);
              }
              setTitle(event.target.value);
            }}
            placeholder="Например, созвониться с клиентом"
            aria-invalid={errorField === 'title' ? 'true' : 'false'}
          />
        </label>
        <label className={styles.label}>
          Дата и время
          <input
            type="datetime-local"
            className={styles.input}
            value={due}
            onChange={(event) => {
              if (errorField === 'due') {
                setError(null);
                setErrorField(null);
              }
              setDue(event.target.value);
            }}
            step={60}
            aria-invalid={errorField === 'due' ? 'true' : 'false'}
          />
        </label>
        <label className={styles.label}>
          Квадрант
          <select
            className={`${styles.input} ${styles.select}`}
            value={quadrant}
            onChange={(event) => setQuadrant(event.target.value as Quadrant)}
          >
            {QUADRANT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {error ? <div className={styles.error}>{error}</div> : null}
        <button type="submit" className={styles.submit} disabled={isSubmitDisabled}>
          Добавить задачу
        </button>
      </form>
    );
  },
);

ManualTaskForm.displayName = 'ManualTaskForm';
