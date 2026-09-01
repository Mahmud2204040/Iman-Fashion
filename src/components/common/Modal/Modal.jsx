import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.css';

/**
 * Modal — generic accessible modal.
 *
 * - Renders in a portal at document.body so z-index stacking is reliable.
 * - Locks body scroll while open.
 * - Closes on Escape.
 * - Click on overlay closes (unless `dismissable={false}`).
 * - Focus moves to the first focusable element on open and returns on close.
 *
 * Props:
 *   open, onClose, title, children, footer, size, dismissable
 */
function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  dismissable = true,
  className = '',
  labelledBy,
}) {
  const dialogRef = useRef(null);
  const previousActiveRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    previousActiveRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move focus into the dialog.
    const focusTarget = dialogRef.current;
    if (focusTarget) {
      const firstFocusable = focusTarget.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      (firstFocusable || focusTarget).focus({ preventScroll: true });
    }

    const handleKey = (e) => {
      if (e.key === 'Escape' && dismissable) {
        e.stopPropagation();
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKey);

    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
      const prev = previousActiveRef.current;
      if (prev && typeof prev.focus === 'function') {
        prev.focus({ preventScroll: true });
      }
    };
  }, [open, dismissable, onClose]);

  if (!open) return null;

  const handleOverlayClick = (e) => {
    if (!dismissable) return;
    if (e.target === e.currentTarget) onClose?.();
  };

  const titleId = labelledBy || (title ? 'modal-title' : undefined);

  const dialogClasses = [
    styles.dialog,
    styles[`size-${size}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return createPortal(
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div
        ref={dialogRef}
        className={dialogClasses}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        {title ? (
          <header className={styles.header}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {dismissable ? (
              <button
                type="button"
                className={styles.closeBtn}
                aria-label="Close"
                onClick={onClose}
              >
                ×
              </button>
            ) : null}
          </header>
        ) : null}

        <div className={styles.body}>{children}</div>

        {footer ? <footer className={styles.footer}>{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}

export default Modal;