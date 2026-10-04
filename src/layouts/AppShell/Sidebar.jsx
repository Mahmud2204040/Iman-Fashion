import { useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

import { LogoutIcon } from '../../components/icons/DashboardIcon.jsx';
import { filterNavByRole, isSubGroup } from '../../constants/navigation.js';
import { ROLES } from '../../constants/roles.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import Logo from './Logo.jsx';
import styles from './AppShell.module.css';

function visibleLinks(group) {
  return group.items.flatMap((entry) => isSubGroup(entry) ? entry.items : [entry]);
}

/** Every permitted destination is a direct link; section labels never toggle. */
function Sidebar({ onNavigate, collapsed = false, onToggle, isDrawer = false }) {
  const { user, role, logout } = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();
  const groups = useMemo(() => filterNavByRole(role), [role]);

  async function handleSignOut() {
    try {
      await logout();
      navigate('/login', { replace: true });
      onNavigate?.();
    } catch {
      window.alert(t('Could not sign out. Check the API connection and try again.'));
    }
  }

  return (
    <aside className={[styles.sidebar, collapsed && !isDrawer ? styles.sidebarCollapsed : ''].filter(Boolean).join(' ')} aria-label="Primary navigation">
      <div className={styles.sidebarHeader}>
        <Logo compact={collapsed && !isDrawer} />
        <button
          type="button"
          className={styles.sidebarToggle}
          onClick={onToggle}
          aria-label={t(isDrawer ? 'Close navigation' : collapsed ? 'Expand navigation' : 'Collapse navigation')}
          title={t(isDrawer ? 'Close navigation' : collapsed ? 'Expand navigation' : 'Collapse navigation')}
        >
          {isDrawer ? '×' : collapsed ? '›' : '«'}
        </button>
      </div>

      <nav className={styles.sidebarNav}>
        {groups.map((group) => (
          <section key={group.id} className={styles.sidebarGroup} aria-label={t(group.label)}>
            {(!collapsed || isDrawer) && <div className={styles.sidebarGroupTitle}>{t(group.label)}</div>}
            <ul className={collapsed && !isDrawer ? styles.sidebarCompactList : styles.sidebarList}>
              {visibleLinks(group).map((entry) => {
                const Icon = entry.icon;
                const compact = collapsed && !isDrawer;
                return (
                  <li key={entry.id}>
                    <NavLink
                      to={entry.path}
                      end={entry.end}
                      onClick={onNavigate}
                      title={compact ? t(entry.label) : undefined}
                      aria-label={compact ? t(entry.label) : undefined}
                      className={({ isActive }) => [
                        compact ? styles.sidebarCompactItem : styles.sidebarLink,
                        isActive ? (compact ? styles.sidebarCompactItemActive : styles.sidebarLinkActive) : '',
                      ].filter(Boolean).join(' ')}
                    >
                      {Icon ? <span className={styles.sidebarLinkIcon} aria-hidden="true"><Icon size={compact ? 20 : 18} strokeWidth={1.75} /></span> : null}
                      {!compact && <span className={styles.sidebarLinkLabel}>{t(entry.label)}</span>}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </nav>

      <div className={styles.sidebarFooter}>
        <NavLink to="/profile" onClick={onNavigate} className={styles.sidebarUser} aria-label={t('My profile')}>
          <div className={styles.sidebarAvatar} aria-hidden="true">
            {(user && user.username ? user.username : '?').slice(0, 1).toUpperCase()}
          </div>
          {(!collapsed || isDrawer) && <div className={styles.sidebarUserMeta}>
            <div className={styles.sidebarUserName}>{user ? user.username : 'Guest'}</div>
            <div className={styles.sidebarUserRole}>
              {role === ROLES.OWNER ? 'Owner' : role === ROLES.EMPLOYEE ? 'Employee' : 'Signed out'}
            </div>
          </div>}
        </NavLink>
        <button
          type="button"
          className={styles.sidebarSignout}
          onClick={handleSignOut}
          title={t('Sign out')}
          aria-label={t('Sign out')}
        >
          <LogoutIcon size={19} strokeWidth={1.75} />
          {(!collapsed || isDrawer) && <span>{t('Sign out')}</span>}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
