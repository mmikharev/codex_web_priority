import { ReactNode, useEffect } from 'react';
import styles from './Modal.module.css';

interface ModalProps {
  open: boolean;
  title?: string;
  children: ReactNode;
  onClose: () => void;
}

export function Modal({ open, title, children, onClose }: ModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label={title}>
      <div className={styles.container}>
        <header className={styles.header}>
          {title ? <h2 className={styles.title}>{title}</h2> : null}
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Закрыть окно">
            <svg viewBox="0 0 24 24" className={styles.closeIcon}>
              <path d="m18.3 5.71-1.41-1.42L12 9.17 7.11 4.29 5.7 5.7 10.59 10.6 5.7 15.49l1.41 1.41L12 12l4.89 4.9 1.41-1.41-4.88-4.9 4.88-4.88Z" />
            </svg>
          </button>
        </header>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
