import { useLocation } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth.js';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { useTicker } from '../../hooks/useTicker.js';
import { ROLES } from '../../constants/roles.js';
import { DATE_FORMAT } from '../../constants/app.js';
import { NAV_GROUPS, isSubGroup } from '../../constants/navigation.js';
import {
  CalendarIcon,
  MenuIcon,
} from '../../components/icons/DashboardIcon.jsx';
import Logo from './Logo.jsx';
import styles from './Topbar.module.css';

/**
 * Topbar — sticky bar above the page content.
 *
 * Left:  mobile menu toggle + Iman Fashion brand logo (the brand sits in
 *        the topbar so the dashboard hero can stay text-only).
 * Right: clock, refresh action, sign-out.
 *
 * The clock and date are bound to a `useTicker` hook so they keep
 * current time without a per-second render.
 */
function currentCrumb(pathname) {
  if (pathname === '/profile') return ['My profile'];
  const entries = NAV_GROUPS.flatMap((group) => group.items.flatMap((item) =>
    isSubGroup(item) ? item.items.map((leaf) => ({ group, leaf })) : [{ group, leaf: item }],
  ));
  const match = entries
    .filter(({ leaf }) => leaf.path && (pathname === leaf.path || pathname.startsWith(`${leaf.path}/`)))
    .sort((a, b) => b.leaf.path.length - a.leaf.path.length)[0];
  return match ? [match.group.label, match.leaf.label] : ['Overview'];
}

function Topbar({ onOpenMobileMenu, menuButtonRef }) {
  const location = useLocation();
  const { role, user } = useAuth();
  const { language, changeLanguage, t } = useLocale();
  const now = useTicker(60_000);

  const dateText = new Intl.DateTimeFormat(
    language === 'bn' ? 'bn-BD-u-nu-latn' : DATE_FORMAT.locale,
    { ...DATE_FORMAT.options, weekday: 'short', month: 'short', timeZone: 'Asia/Dhaka' },
  ).format(now);
  const timeText = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Dhaka',
  }).format(now);

  const roleLabel =
    role === ROLES.OWNER
      ? 'Owner'
      : role === ROLES.EMPLOYEE
        ? 'Employee'
        : 'Guest';
  const crumbs = currentCrumb(location.pathname);

  return (
    <header className={styles.topbar}>
      <div className={styles.topbarLeft}>
        <button
          ref={menuButtonRef}
          type="button"
          className={styles.topbarMenuButton}
          aria-label={t('Open navigation')}
          onClick={onOpenMobileMenu}
        >
          <MenuIcon size={20} />
        </button>

        <div className={styles.topbarBrand} aria-label="Iman Fashion">
          <Logo tone="light" />
        </div>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <span>IMAN FASHION</span>
          {crumbs.map((crumb) => <span key={crumb}>{t(crumb)}</span>)}
        </nav>
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

        <select
          className={styles.languageSelect}
          aria-label="Language / ভাষা"
          value={language}
          onChange={(event) => changeLanguage(event.target.value)}
        >
          <option value="en">English</option>
          <option value="bn">বাংলা</option>
        </select>

        <span className={styles.topbarRole} title={user?.username || roleLabel}>
          {t(roleLabel)}
        </span>
      </div>
    </header>
  );
}

export default Topbar;
