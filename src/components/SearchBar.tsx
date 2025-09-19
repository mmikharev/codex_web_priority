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
          <path
            d="M10.75 2.5a8.25 8.25 0 0 1 6.4 13.52l4.17 4.16a1.35 1.35 0 0 1-1.91 1.91l-4.16-4.17A8.25 8.25 0 1 1 10.75 2.5Zm0 2.7a5.55 5.55 0 1 0 0 11.1 5.55 5.55 0 0 0 0-11.1Z"
          />
        </svg>
      </button>
      <div className={styles.inputContainer}>
        <input
          ref={inputRef}
          className={styles.searchInput}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Поиск по всем задачам"
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
