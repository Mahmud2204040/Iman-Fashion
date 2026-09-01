import { useEffect, useState } from 'react';

import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import BottomNav from '../../components/layout/BottomNav/BottomNav.jsx';
import styles from './AppShell.module.css';

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
 * On <768px the sidebar becomes a slide-in drawer with a scrim; the
 * topbar gains a hamburger button.
 *
 * `children` is the page body. Pages can opt into the shell's full
 * width or stay within `--layout-content-max-width`.
 */
function AppShell({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  function closeDrawer() { setDrawerOpen(false); }
  function openDrawer()  { setDrawerOpen(true);  }

  // Close drawer on Escape — common drawer convention.
  useEffect(() => {
    if (!drawerOpen) return undefined;
    function onKey(e) { if (e.key === 'Escape') closeDrawer(); }
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
    <div className={styles.shell}>
      {/* Desktop sidebar */}
      <div className={styles.sidebarSlot}>
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      <div
        className={[styles.drawer, drawerOpen ? styles.drawerOpen : ''].filter(Boolean).join(' ')}
        aria-hidden={!drawerOpen}
      >
        <div className={styles.drawerInner}>
          <Sidebar onNavigate={closeDrawer} />
        </div>
        <button
          type="button"
          aria-label="Close navigation"
          className={styles.drawerScrim}
          onClick={closeDrawer}
        />
      </div>

      <div className={styles.main}>
        <Topbar onOpenMobileMenu={openDrawer} />
        <div className={styles.content}>{children}</div>
        <BottomNav />
      </div>
    </div>
  );
}

export default AppShell;