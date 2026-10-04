import { useEffect, useRef, useState } from 'react';

import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import styles from './AppShell.module.css';

const SIDEBAR_PREFERENCE_KEY = 'ni-fashion.sidebar.expanded';

function savedSidebarPreference() {
  try {
    return window.localStorage.getItem(SIDEBAR_PREFERENCE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * AppShell — the chrome that wraps every authenticated page.
 *
 * Layout grid (desktop):
 *
 *   ┌─────────┬──────────────────────────────┐
 *   │         │  Topbar                      │
 *   │ Sidebar ├──────────────────────────────┤
 *   │         │  Content (page-specific)     │
 *   │         │                              │
 *   └─────────┴──────────────────────────────┘
 *
 * Below 1024px the sidebar becomes a slide-in drawer with a scrim; the
 * topbar gains a hamburger button.
 *
 * `children` is the page body. Pages can opt into the shell's full
 * width or stay within `--layout-content-max-width`.
 */
function AppShell({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(savedSidebarPreference);
  const drawerRef = useRef(null);
  const menuButtonRef = useRef(null);

  function closeDrawer() {
    setDrawerOpen(false);
    menuButtonRef.current?.focus();
  }
  function openDrawer()  { setDrawerOpen(true);  }

  function toggleSidebar() {
    setSidebarExpanded((current) => {
      const next = !current;
      try { window.localStorage.setItem(SIDEBAR_PREFERENCE_KEY, String(next)); } catch { /* optional preference */ }
      return next;
    });
  }

  // Close drawer on Escape — common drawer convention.
  useEffect(() => {
    if (!drawerOpen) return undefined;
    drawerRef.current?.querySelector('button')?.focus();
    function onKey(e) {
      if (e.key === 'Escape') closeDrawer();
      if (e.key !== 'Tab' || !drawerRef.current) return;
      const focusable = [...drawerRef.current.querySelectorAll('a[href], button:not([disabled])')];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  // Lock body scroll while the drawer is open on mobile.
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [drawerOpen]);

  return (
    <div className={[styles.shell, sidebarExpanded ? styles.shellExpanded : ''].filter(Boolean).join(' ')}>
      {/* Desktop sidebar */}
      <div className={styles.sidebarSlot}>
        <Sidebar collapsed={!sidebarExpanded} onToggle={toggleSidebar} />
      </div>

      {/* Mobile drawer */}
      <div
        className={[styles.drawer, drawerOpen ? styles.drawerOpen : ''].filter(Boolean).join(' ')}
        aria-hidden={!drawerOpen}
      >
        <button
          type="button"
          aria-label="Close navigation"
          className={styles.drawerScrim}
          onClick={closeDrawer}
          tabIndex={drawerOpen ? 0 : -1}
        />
        <div
          ref={drawerRef}
          className={styles.drawerInner}
          role={drawerOpen ? 'dialog' : undefined}
          aria-modal={drawerOpen ? 'true' : undefined}
          aria-label="Navigation"
          inert={!drawerOpen ? true : undefined}
        >
          <Sidebar onNavigate={closeDrawer} onToggle={closeDrawer} isDrawer />
        </div>
      </div>

      <div className={styles.main}>
        <Topbar onOpenMobileMenu={openDrawer} menuButtonRef={menuButtonRef} />
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}

export default AppShell;
