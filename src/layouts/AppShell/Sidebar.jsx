import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import { ChevronDownIcon } from '../../components/icons/DashboardIcon.jsx';
import { filterNavByRole, isSubGroup } from '../../constants/navigation.js';
import { ROLES } from '../../constants/roles.js';
import { useAuth } from '../../hooks/useAuth.js';
import Logo from './Logo.jsx';
import styles from './AppShell.module.css';

/**
 * Sidebar — dark, premium navigation rail.
 *
 * - Collapses to icon-only on small screens via the AppShell's drawer.
 * - Active route is highlighted with a brand-tinted background and a
 *   2px accent bar on the leading edge.
 * - Role-aware: items filtered through `filterNavByRole` are hidden.
 * - Supports nested sub-groups (e.g. Inventory → Product & Stock /
 *   Raw Material Stock) with collapsible headers. The active sub-group
 *   is auto-expanded on navigation.
 *
 * Visual cues:
 *   - Background is `--color-sidebar-bg` (near-black) for that polished
 *     SaaS feel; the rest of the app stays light.
 *   - Hover state is subtle (4% white) to keep noise low.
 *   - Active state is brand-tinted (~18% primary) — visible without
 *     dominating the rail.
 */

/** True if any descendant leaf of `entry` matches `activePath`. */
function entryMatchesPath(entry, activePath) {
  if (isSubGroup(entry)) {
    return entry.items.some((leaf) => entryMatchesPath(leaf, activePath));
  }
  return Boolean(entry.path && activePath.startsWith(entry.path));
}

/** True if any leaf of `group` matches `activePath`. */
function groupMatchesPath(group, activePath) {
  return group.items.some((entry) => entryMatchesPath(entry, activePath));
}

function Sidebar({ onNavigate }) {
  const { user, role } = useAuth();
  const location = useLocation();
  const groups = useMemo(() => filterNavByRole(role), [role]);

  // Open state for top-level groups and sub-groups, keyed by entry id.
  const [openMap, setOpenMap] = useState({});

  // Whenever the route (or visible groups) changes, ensure the active
  // top-level group and its active sub-group are expanded. We merge the
  // auto-set into `openMap` so the user's manual collapse choice is
  // respected until the next navigation.
  useEffect(() => {
    const auto = {};
    for (const group of groups) {
      if (groupMatchesPath(group, location.pathname)) {
        auto[group.id] = true;
        for (const entry of group.items) {
          if (
            isSubGroup(entry) &&
            entryMatchesPath(entry, location.pathname)
          ) {
            auto[entry.id] = true;
          }
        }
      }
    }
    if (Object.keys(auto).length > 0) {
      setOpenMap((prev) => ({ ...prev, ...auto }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, groups]);

  const toggle = (id) =>
    setOpenMap((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <aside className={styles.sidebar} aria-label="Primary navigation">
      <div className={styles.sidebarHeader}>
        <Logo compact />
      </div>

      <nav className={styles.sidebarNav}>
        {groups.map((group) => {
          const groupOpen = openMap[group.id] ?? false;
          const groupActive = groupMatchesPath(group, location.pathname);

          return (
            <div key={group.id} className={styles.sidebarGroup}>
              <button
                type="button"
                className={[
                  styles.sidebarGroupToggle,
                  groupActive ? styles.sidebarGroupToggleActive : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => toggle(group.id)}
                aria-expanded={groupOpen}
              >
                <span className={styles.sidebarGroupLabel}>{group.label}</span>
                <ChevronDownIcon
                  className={[
                    styles.sidebarGroupChevron,
                    groupOpen ? styles.sidebarGroupChevronOpen : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-hidden="true"
                />
              </button>

              {groupOpen && (
                <ul className={styles.sidebarList}>
                  {group.items.map((entry) => {
                    if (isSubGroup(entry)) {
                      const subOpen = openMap[entry.id] ?? false;
                      const subActive = entryMatchesPath(
                        entry,
                        location.pathname,
                      );
                      const SubIcon = entry.icon;
                      return (
                        <li key={entry.id} className={styles.sidebarSubGroup}>
                          <button
                            type="button"
                            className={[
                              styles.sidebarSubToggle,
                              subActive ? styles.sidebarSubToggleActive : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            onClick={() => toggle(entry.id)}
                            aria-expanded={subOpen}
                          >
                            {SubIcon ? (
                              <span
                                className={styles.sidebarSubIcon}
                                aria-hidden="true"
                              >
                                <SubIcon size={16} strokeWidth={1.75} />
                              </span>
                            ) : null}
                            <span className={styles.sidebarSubLabel}>
                              {entry.label}
                            </span>
                            <ChevronDownIcon
                              className={[
                                styles.sidebarSubChevron,
                                subOpen ? styles.sidebarSubChevronOpen : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                              aria-hidden="true"
                            />
                          </button>
                          {subOpen && (
                            <ul className={styles.sidebarSubList}>
                              {entry.items.map((leaf) => {
                                const LeafIcon = leaf.icon;
                                return (
                                  <li key={leaf.id}>
                                    <NavLink
                                      to={leaf.path}
                                      end={leaf.end}
                                      onClick={onNavigate}
                                      className={({ isActive }) =>
                                        [
                                          styles.sidebarLink,
                                          styles.sidebarLinkChild,
                                          isActive
                                            ? styles.sidebarLinkActive
                                            : '',
                                        ]
                                          .filter(Boolean)
                                          .join(' ')
                                      }
                                    >
                                      <span
                                        className={styles.sidebarLinkIcon}
                                        aria-hidden="true"
                                      >
                                        {LeafIcon ? (
                                          <LeafIcon
                                            size={16}
                                            strokeWidth={1.75}
                                          />
                                        ) : null}
                                      </span>
                                      <span className={styles.sidebarLinkLabel}>
                                        {leaf.label}
                                      </span>
                                      <span
                                        className={styles.sidebarLinkBar}
                                        aria-hidden="true"
                                      />
                                    </NavLink>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </li>
                      );
                    }

                    // Direct leaf under the top-level group.
                    const Icon = entry.icon;
                    return (
                      <li key={entry.id}>
                        <NavLink
                          to={entry.path}
                          end={entry.end}
                          onClick={onNavigate}
                          className={({ isActive }) =>
                            [
                              styles.sidebarLink,
                              isActive ? styles.sidebarLinkActive : '',
                            ]
                              .filter(Boolean)
                              .join(' ')
                          }
                        >
                          <span
                            className={styles.sidebarLinkIcon}
                            aria-hidden="true"
                          >
                            <Icon size={18} strokeWidth={1.75} />
                          </span>
                          <span className={styles.sidebarLinkLabel}>
                            {entry.label}
                          </span>
                          <span
                            className={styles.sidebarLinkBar}
                            aria-hidden="true"
                          />
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      <div className={styles.sidebarFooter}>
        <div className={styles.sidebarUser}>
          <div className={styles.sidebarAvatar} aria-hidden="true">
            {(user && user.username ? user.username : '?')
              .slice(0, 1)
              .toUpperCase()}
          </div>
          <div className={styles.sidebarUserMeta}>
            <div className={styles.sidebarUserName}>
              {user ? user.username : 'Guest'}
            </div>
            <div className={styles.sidebarUserRole}>
              {role === ROLES.OWNER
                ? 'Owner'
                : role === ROLES.EMPLOYEE
                  ? 'Employee'
                  : 'Signed out'}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;