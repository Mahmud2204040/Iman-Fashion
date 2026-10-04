import { NavLink } from 'react-router-dom';

import { filterNavByRole, isSubGroup } from '../../../constants/navigation.js';
import { useAuth } from '../../../hooks/useAuth.js';
import { useLocale } from '../../../contexts/LocaleContext.jsx';
import styles from './BottomNav.module.css';

/**
 * BottomNav — fixed bottom navigation for <768px screens.
 *
 * Renders only the **first leaf from each top-level nav group** (Dashboard,
 * Sales, Customers, Products, Cash, …) so the bar doesn't get crowded.
 * Hidden on desktop via CSS.
 *
 * Sub-groups are skipped — a mobile bar can only carry single-route tabs.
 * If a group's first entry is a sub-group, we dig one level deeper; if even
 * that yields no leaf, the group is omitted.
 *
 * Active state uses a brand-tinted pill above the icon — visible but
 * gentle.
 */
function BottomNav() {
  const { role } = useAuth();
  const { t } = useLocale();
  const groups = filterNavByRole(role);

  // Pick the first leaf per group. If the first item is a sub-group, fall
  // back to its first leaf. Otherwise the group contributes nothing.
  const items = groups
    .map((g) => {
      const first = g.items[0];
      if (!first) return null;
      if (!isSubGroup(first)) return first;
      const leaf = first.items && first.items[0];
      return leaf && !isSubGroup(leaf) ? leaf : null;
    })
    .filter(Boolean);

  if (items.length === 0) return null;

  return (
    <nav className={styles.bar} aria-label="Primary navigation (mobile)">
      <ul className={styles.list}>
        {items.map((item) => {
          const Icon = item.icon;
          if (!Icon) return null;
          return (
            <li key={item.id} className={styles.item}>
              <NavLink
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  [
                    styles.link,
                    isActive ? styles.linkActive : '',
                  ]
                    .filter(Boolean)
                    .join(' ')
                }
              >
                <span className={styles.iconWrap} aria-hidden="true">
                  <Icon size={20} strokeWidth={1.75} />
                </span>
                <span className={styles.label}>{t(item.label)}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default BottomNav;
