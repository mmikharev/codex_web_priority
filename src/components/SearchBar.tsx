import styles from './SearchBar.module.css';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  inputRef?: React.RefObject<HTMLInputElement>;
}

export function SearchBar({ value, onChange, onClear, inputRef }: SearchBarProps) {
  return (
    <div className={styles.wrapper}>
      <input
        ref={inputRef}
        className={styles.searchInput}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Поиск по бэклогу"
        type="search"
      />
      <button type="button" className={styles.clearButton} onClick={onClear}>
        Очистить
      </button>
    </div>
  );
}
