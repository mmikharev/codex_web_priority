import styles from './AddTaskButton.module.css';

interface AddTaskButtonProps {
  onClick: () => void;
}

export function AddTaskButton({ onClick }: AddTaskButtonProps) {
  return (
    <button type="button" className={styles.button} onClick={onClick} aria-label="Добавить задачу">
      <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden>
        <path d="M12 5a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H6a1 1 0 1 1 0-2h5V6a1 1 0 0 1 1-1Z" />
      </svg>
    </button>
  );
}
