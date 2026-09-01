import { useEffect, useId, useRef, useState } from 'react';

import Button from '../../../common/Button/Button.jsx';
import Textarea from '../../../common/Textarea/Textarea.jsx';
import { CheckIcon, NoteIcon } from '../../../icons/DashboardIcon.jsx';
import styles from './NotesWidget.module.css';

/**
 * NotesWidget — owner-only scratchpad shown on the dashboard.
 *
 * - Persists the note body to `localStorage` under `STORAGE_KEYS.NOTES`
 *   so it survives reloads without a backend round-trip.
 * - "Save Note" is the explicit save action — pressing Enter inside the
 *   textarea also commits (Ctrl/Cmd + Enter). Just typing does not save.
 * - Empty notes clear the stored value, so the widget behaves like a
 *   temporary notepad and never shows a stale "ghost" on reload.
 *
 * The card itself is sized via CSS to fit inside a 100vh dashboard.
 */
const STORAGE_KEY = 'ni-fashion.dashboard.notes';
const MAX_LENGTH = 600;

function loadNote() {
  if (typeof window === 'undefined') return '';
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return typeof raw === 'string' ? raw : '';
  } catch {
    return '';
  }
}

function saveNote(value) {
  if (typeof window === 'undefined') return;
  try {
    if (value && value.length > 0) {
      window.localStorage.setItem(STORAGE_KEY, value);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // localStorage may be disabled — fail silently, this is a non-critical
    // convenience feature.
  }
}

function NotesWidget() {
  const textareaId = useId();
  const [draft, setDraft] = useState(loadNote);
  const [savedAt, setSavedAt] = useState(null);
  const taRef = useRef(null);

  // Keep the textarea in sync if another tab edits the same key.
  useEffect(() => {
    function onStorage(event) {
      if (event.key !== STORAGE_KEY) return;
      setDraft(typeof event.newValue === 'string' ? event.newValue : '');
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  function commit() {
    const trimmed = draft.trim();
    saveNote(trimmed);
    setDraft(trimmed);
    setSavedAt(new Date());
  }

  function handleKeyDown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      commit();
    }
  }

  const remaining = MAX_LENGTH - draft.length;
  const overLimit = remaining < 0;

  const hintText = savedAt
    ? `Saved at ${new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(savedAt)}`
    : 'Notes are saved locally to your account.';

  return (
    <section className={styles.card} aria-labelledby="dashboard-notes-heading">
      <header className={styles.header}>
        <span className={styles.icon} aria-hidden="true">
          <NoteIcon size={18} strokeWidth={1.75} />
        </span>
        <div className={styles.headerText}>
          <h2 id="dashboard-notes-heading" className={styles.title}>
            Notes & Reminders
          </h2>
          <span className={styles.subtitle}>Private to this account</span>
        </div>
      </header>

      <Textarea
        ref={taRef}
        id={textareaId}
        className={styles.textarea}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Jot down quick reminders — fabric orders to call, customer dues to chase, weekend plans…"
        rows={4}
        maxLength={MAX_LENGTH + 100}
        invalid={overLimit}
        aria-label="Note text"
      />

      <div className={styles.footer}>
        <span
          className={`${styles.hint} ${overLimit ? styles.hintError : ''}`}
        >
          {overLimit
            ? `Over limit by ${Math.abs(remaining)} characters`
            : hintText}
        </span>

        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={commit}
          disabled={overLimit || draft.trim().length === 0}
          leftIcon={<CheckIcon size={14} strokeWidth={2} />}
        >
          Save note
        </Button>
      </div>
    </section>
  );
}

export default NotesWidget;
