import { useEffect } from 'react';
import styles from './SearchBar.module.css';

interface SearchBarProps {
  value: string;
  expanded: boolean;
  onChange: (value: string) => void;
  onClear: () => void;
  onToggle: (next: boolean) => void;
  inputRef?: React.RefObject<HTMLInputElement>;
}

export function SearchBar({ value, expanded, onChange, onClear, onToggle, inputRef }: SearchBarProps) {
  useEffect(() => {
    if (expanded) {
      window.requestAnimationFrame(() => {
        inputRef?.current?.focus();
        inputRef?.current?.select();
      });
    }
  }, [expanded, inputRef]);

  const handleClear = () => {
    onClear();
    if (!value) {
      onToggle(false);
    }
  };

  return (
    <div className={`${styles.wrapper} ${expanded ? styles.expanded : ''}`.trim()}>
      <button
        type="button"
        className={styles.iconButton}
        aria-label="Поиск"
        onClick={() => onToggle(!expanded)}
      >
        <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden>
          <path d="M21 21a1 1 0 0 1-1.71.71l-4.92-4.93a7 7 0 1 1 1.41-1.41l4.93 4.92A1 1 0 0 1 21 21Zm-10-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />
        </svg>
      </button>
      <div className={styles.inputContainer}>
        <input
          ref={inputRef}
          className={styles.searchInput}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Поиск по бэклогу"
          type="search"
          aria-hidden={!expanded}
        />
        <button type="button" className={styles.clearButton} onClick={handleClear}>
          Очистить
        </button>
      </div>
    </div>
  );
}
