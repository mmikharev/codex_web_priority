import styles from './ThemeToggleButton.module.css';

interface ThemeToggleButtonProps {
  theme: 'light' | 'dark';
  onToggle: () => void;
}

export function ThemeToggleButton({ theme, onToggle }: ThemeToggleButtonProps) {
  return (
    <button
      type="button"
      className={styles.button}
      onClick={onToggle}
      aria-label={theme === 'light' ? 'Включить тёмную тему' : 'Включить светлую тему'}
    >
      <span aria-hidden>
        {theme === 'light' ? (
          <svg viewBox="0 0 24 24" className={styles.icon}>
            <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0 4a1 1 0 0 1-1-1v-1a1 1 0 1 1 2 0v1a1 1 0 0 1-1 1Zm0-20a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1Zm10 9a1 1 0 0 1 0 2h-1a1 1 0 1 1 0-2h1Zm-18 0a1 1 0 0 1 0 2H3a1 1 0 1 1 0-2h1Zm15.07 7.07a1 1 0 0 1-1.41 1.41l-.71-.7a1 1 0 0 1 1.41-1.42l.71.71Zm-12-12a1 1 0 0 1-1.41 1.41l-.71-.7a1 1 0 0 1 1.41-1.42l.71.71Zm-1.42 12a1 1 0 0 1 1.42-1.41l.7.71a1 1 0 1 1-1.41 1.41l-.71-.71Zm12-12a1 1 0 1 1 1.41-1.41l.71.7a1 1 0 1 1-1.42 1.42l-.7-.71Z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className={styles.icon}>
            <path d="M21.64 13.65A1 1 0 0 0 20.6 13a8 8 0 0 1-9.6-9.6 1 1 0 0 0-1.18-1.18 10 10 0 1 0 11.83 11.83 1 1 0 0 0-.01-.4Z" />
          </svg>
        )}
      </span>
    </button>
  );
}
