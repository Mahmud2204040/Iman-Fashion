import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth.js';
import { useTicker } from '../../hooks/useTicker.js';
import { ROLES } from '../../constants/roles.js';
import { DATE_FORMAT } from '../../constants/app.js';
import Button from '../../components/common/Button/Button.jsx';
import {
  CalendarIcon,
  LogoutIcon,
  MenuIcon,
  RefreshIcon,
} from '../../components/icons/DashboardIcon.jsx';
import styles from './Topbar.module.css';

/**
 * Topbar — sticky bar above the page content.
 *
 * Left:  mobile menu toggle (hidden >=768px).
 * Right: clock, role badge, refresh action, sign-out.
 *
 * The clock and date are bound to a `useTicker` hook so they keep
 * current time without a per-second render. The tab visibility hook
 * also catches up when the user returns from another tab.
 */
function Topbar({ onOpenMobileMenu }) {
  const navigate = useNavigate();
  const { user, role, logout } = useAuth();
  const now = useTicker(60_000);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  const dateText = new Intl.DateTimeFormat(
    DATE_FORMAT.locale,
    DATE_FORMAT.options,
  ).format(now);
  const timeText = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(now);

  const roleLabel =
    role === ROLES.OWNER
      ? 'Owner'
      : role === ROLES.EMPLOYEE
        ? 'Employee'
        : 'Guest';
  const roleClass =
    role === ROLES.OWNER
      ? styles.topbarRoleOwner
      : role === ROLES.EMPLOYEE
        ? styles.topbarRoleEmployee
        : styles.topbarRoleGuest;

  return (
    <header className={styles.topbar}>
      <div className={styles.topbarLeft}>
        <button
          type="button"
          className={styles.topbarMenuButton}
          aria-label="Open navigation"
          onClick={onOpenMobileMenu}
        >
          <MenuIcon size={20} />
        </button>
      </div>

      <div className={styles.topbarRight}>
        <div className={styles.topbarClock} aria-live="polite">
          <span className={styles.topbarClockIcon}>
            <CalendarIcon size={16} strokeWidth={1.75} />
          </span>
          <span className={styles.topbarDate}>{dateText}</span>
          <span className={styles.topbarDivider} aria-hidden="true">
            &middot;
          </span>
          <span className={styles.topbarTime}>{timeText}</span>
        </div>

        <span className={roleClass}>
          <span className={styles.topbarRoleDot} aria-hidden="true" />
          {roleLabel}
        </span>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.location.reload()}
          leftIcon={<RefreshIcon size={16} strokeWidth={1.75} />}
        >
          Refresh
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleLogout}
          leftIcon={<LogoutIcon size={16} strokeWidth={1.75} />}
        >
          Sign out
        </Button>

        {user && user.username ? (
          <span
            className={styles.topbarUser}
            title={user.username}
          >
            {user.username}
          </span>
        ) : null}
      </div>
    </header>
  );
}

export default Topbar;
