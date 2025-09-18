import { useState } from 'react';
import styles from './ImportPanel.module.css';

interface ImportPanelProps {
  value: string;
  onChange: (value: string) => void;
  onImport: (jsonText: string, options: { resetQuadrants: boolean }) => Promise<void> | void;
  onExport: () => void;
  feedback?: string | null;
  error?: string | null;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
}

export function ImportPanel({ value, onChange, onImport, onExport, feedback, error, textareaRef }: ImportPanelProps) {
  const [resetQuadrants, setResetQuadrants] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleImport = async () => {
    if (!value.trim()) {
      return;
    }

    setIsProcessing(true);
    try {
      await onImport(value, { resetQuadrants });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = () => {
    onExport();
  };

  return (
    <section className={styles.panel}>
      <label className={styles.label} htmlFor="import-json">
        Импорт JSON
      </label>
      <textarea
        id="import-json"
        ref={textareaRef}
        className={styles.textarea}
        placeholder='{"version":2,"tasks":{"Task":{"title":"Task","due":"1. 10. 2025 at 0:00","quadrant":"Q1","done":false}}}'
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className={styles.controls}>
        <div className={styles.leftGroup}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={resetQuadrants}
              onChange={(event) => setResetQuadrants(event.target.checked)}
            />
            Переместить все задачи в бэклог
          </label>
        </div>
        <div className={styles.buttons}>
          <button className={styles.secondaryButton} type="button" onClick={handleExport}>
            Экспорт JSON
          </button>
          <button
            className={styles.primaryButton}
            type="button"
            onClick={handleImport}
            disabled={isProcessing}
          >
            {isProcessing ? 'Импорт...' : 'Импорт'}
          </button>
        </div>
      </div>
      {feedback ? <div className={styles.feedback}>{feedback}</div> : null}
      {error ? <div className={styles.error}>{error}</div> : null}
    </section>
  );
}
