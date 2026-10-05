import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Spinner } from '../../components/common/index.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import {
  createEmployee,
  getEmployees,
  setEmployeePassword,
  setOwnPassword,
  setOwnUsername,
  updateEmployee,
} from '../../services/users/userService.js';
import styles from './ProfilePage.module.css';

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64707d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64707d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64707d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64707d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function UserPlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export default function ProfilePage() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useLocale();
  const isOwner = role === 'OWNER';

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(isOwner);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [ownUsername, setOwnUsernameState] = useState({ currentPassword: '', newUsername: '' });
  const [own, setOwn] = useState({ current: '', next: '', confirm: '' });
  const [newEmployee, setNewEmployee] = useState({ username: '', password: '', confirm: '' });

  const [editing, setEditing] = useState('');
  const [editName, setEditName] = useState('');
  const [passwordTarget, setPasswordTarget] = useState('');
  const [employeePassword, setEmployeePasswordDraft] = useState({ current: '', next: '', confirm: '' });

  const refresh = useCallback(async () => {
    if (!isOwner) return;
    setLoading(true);
    try {
      setEmployees(await getEmployees());
    } catch (caught) {
      setError(caught.message || 'Could not load employees.');
    } finally {
      setLoading(false);
    }
  }, [isOwner]);

  useEffect(() => { refresh(); }, [refresh]);

  function beginAction() { setError(''); setNotice(''); setBusy(true); }

  async function changeUsername(event) {
    event.preventDefault();
    if (!ownUsername.newUsername || ownUsername.newUsername === user.username) return;
    beginAction();
    try {
      await setOwnUsername(ownUsername.currentPassword, ownUsername.newUsername);
      setOwnUsernameState({ currentPassword: '', newUsername: '' });
      setNotice('Username updated successfully. Please log in again.');
      setTimeout(() => logout(), 2000);
    } catch (caught) {
      setError(caught.message || 'Could not update username.');
    } finally {
      setBusy(false);
    }
  }

  async function changeOwnPassword(event) {
    event.preventDefault();
    if (own.next !== own.confirm) { setError('Passwords do not match.'); return; }
    beginAction();
    try {
      await setOwnPassword(own.current, own.next);
      setOwn({ current: '', next: '', confirm: '' });
      await logout();
      navigate('/login', { replace: true });
    } catch (caught) {
      setError(caught.message || 'Could not update password.');
    } finally {
      setBusy(false);
    }
  }

  async function create(event) {
    event.preventDefault();
    if (newEmployee.password !== newEmployee.confirm) { setError('Passwords do not match.'); return; }
    beginAction();
    try {
      await createEmployee({ username: newEmployee.username, password: newEmployee.password });
      setNewEmployee({ username: '', password: '', confirm: '' });
      setNotice('Employee account created.');
      await refresh();
    } catch (caught) {
      setError(caught.message || 'Could not create employee.');
    } finally {
      setBusy(false);
    }
  }

  async function saveEmployee(id, patch) {
    beginAction();
    try {
      await updateEmployee(id, patch);
      setEditing('');
      setNotice('Employee account updated.');
      await refresh();
    } catch (caught) {
      setError(caught.message || 'Could not update employee.');
    } finally {
      setBusy(false);
    }
  }

  async function changeEmployeePassword(event) {
    event.preventDefault();
    if (employeePassword.next !== employeePassword.confirm) { setError('Passwords do not match.'); return; }
    beginAction();
    try {
      await setEmployeePassword(passwordTarget, employeePassword.next, employeePassword.current);
      setPasswordTarget('');
      setEmployeePasswordDraft({ current: '', next: '', confirm: '' });
      setNotice('Employee password updated. Existing sessions were signed out.');
    } catch (caught) {
      setError(caught.message || 'Could not update password.');
    } finally {
      setBusy(false);
    }
  }

  const initial = (user.name || user.username || '?').charAt(0).toUpperCase();
  const now = new Date();
  const lastUpdated = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>{t('Profile')}</h1>
        <p>{t('Manage your account settings and employee accounts')}</p>
      </div>

      {notice ? <p className={styles.notice} role="status">{t(notice)}</p> : null}
      {error ? <p className={styles.error} role="alert">{t(error)}</p> : null}

      {/* Owner Card */}
      <div className={`${styles.card} ${styles.ownerCard}`}>
        <div className={styles.ownerLeft}>
          <div className={styles.ownerAvatar}>{initial}</div>
          <div className={styles.ownerInfo}>
            <div className={styles.ownerNameRow}>
              <h2>{user.name || user.username}</h2>
              <span className={styles.ownerBadge}>OWNER</span>
            </div>
            <div className={styles.ownerStats}>
              <div className={styles.statGroup}>
                <span className={styles.statLabel}>{t('Username')}</span>
                <span className={styles.statValue}>{user.username}</span>
              </div>
              <div className={styles.statGroup}>
                <span className={styles.statLabel}>{t('Status')}</span>
                <span className={styles.statValue}>
                  <span className={styles.statusDot} />
                  {t('Active')}
                </span>
              </div>
              <div className={styles.statGroup}>
                <span className={styles.statLabel}>{t('Last updated')}</span>
                <span className={styles.statValue}>{lastUpdated}</span>
              </div>
            </div>
          </div>
        </div>
        <button className={styles.outlined} type="button">
          <PencilIcon /> {t('Edit profile')}
        </button>
      </div>

      {/* Security Settings */}
      <div className={styles.sectionWrapper}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeaderIcon}><ShieldIcon /></div>
          <div>
            <h2>{t('Security settings')}</h2>
            <p>{t('Manage your authentication credentials')}</p>
          </div>
        </div>

        <div className={styles.securityGrid}>
          {/* Change Username */}
          <div className={styles.subCard}>
            <div className={styles.subCardHeader}>
              <UserIcon />
              <h3>{t('Change username')}</h3>
            </div>
            <p>{t('Update your login username. You will be logged out.')}</p>
            <form className={styles.form} onSubmit={changeUsername}>
              <div className={styles.field}>
                <label>{t('Current password')}</label>
                <input
                  type="password"
                  required
                  value={ownUsername.currentPassword}
                  onChange={(e) => setOwnUsernameState(s => ({ ...s, currentPassword: e.target.value }))}
                />
              </div>
              <div className={styles.field}>
                <label>{t('New username')}</label>
                <input
                  required
                  minLength={3}
                  maxLength={32}
                  pattern="[A-Za-z][A-Za-z0-9._-]{2,31}"
                  value={ownUsername.newUsername}
                  onChange={(e) => setOwnUsernameState(s => ({ ...s, newUsername: e.target.value }))}
                />
              </div>
              <button className={styles.primary} type="submit" disabled={busy}>
                {t('Update username')}
              </button>
            </form>
          </div>

          {/* Change Password */}
          <div className={styles.subCard}>
            <div className={styles.subCardHeader}>
              <LockIcon />
              <h3>{t('Change password')}</h3>
            </div>
            <p>{t('Update your password. All sessions will be revoked.')}</p>
            <form className={styles.form} onSubmit={changeOwnPassword}>
              <div className={styles.field}>
                <label>{t('Current password')}</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  minLength={8}
                  maxLength={128}
                  required
                  value={own.current}
                  onChange={(e) => setOwn(s => ({ ...s, current: e.target.value }))}
                />
              </div>
              <div className={styles.formRow}>
                <div className={styles.field}>
                  <label>{t('New password')}</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    required
                    value={own.next}
                    onChange={(e) => setOwn(s => ({ ...s, next: e.target.value }))}
                  />
                </div>
                <div className={styles.field}>
                  <label>{t('Confirm password')}</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    required
                    value={own.confirm}
                    onChange={(e) => setOwn(s => ({ ...s, confirm: e.target.value }))}
                  />
                </div>
              </div>
              <button className={styles.primary} type="submit" disabled={busy}>
                {t('Update password')}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Employee Accounts */}
      <div className={styles.sectionWrapper}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeaderIcon}><UsersIcon /></div>
          <div>
            <h2>{t('Employee accounts')}</h2>
            <p>{t('Manage employee access to the system')}</p>
          </div>
        </div>

        <div className={styles.employeeGrid}>
          {/* Add New Employee Form */}
          <div className={styles.subCard}>
            <div className={styles.subCardHeader}>
              <UserPlusIcon />
              <h3>{t('Add new employee')}</h3>
            </div>
            <p>{t('Create a new employee account')}</p>
            <form className={styles.form} onSubmit={create}>
              <div className={styles.field}>
                <label>{t('Username')}</label>
                <input
                  required
                  minLength={3}
                  maxLength={32}
                  pattern="[A-Za-z][A-Za-z0-9._-]{2,31}"
                  autoComplete="off"
                  value={newEmployee.username}
                  onChange={(e) => setNewEmployee(s => ({ ...s, username: e.target.value }))}
                />
              </div>
              <div className={styles.field}>
                <label>{t('Password')}</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  value={newEmployee.password}
                  onChange={(e) => setNewEmployee(s => ({ ...s, password: e.target.value }))}
                />
              </div>
              <div className={styles.field}>
                <label>{t('Confirm password')}</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  value={newEmployee.confirm}
                  onChange={(e) => setNewEmployee(s => ({ ...s, confirm: e.target.value }))}
                />
              </div>
              <button className={styles.primary} type="submit" disabled={busy}>
                {t('Create account')}
              </button>
            </form>
          </div>

          {/* Employee Table */}
          <div className={styles.tableWrapper}>
            <div className={styles.tableHeader}>
              <span>#</span>
              <span>{t('Username')}</span>
              <span>{t('Status')}</span>
              <span>{t('Created at')}</span>
              <span>{t('Actions')}</span>
            </div>
            {loading ? (
              <div className={styles.loading}><Spinner size="sm" /> {t('Loading employees...')}</div>
            ) : employees.length === 0 ? (
              <div className={styles.empty}>{t('No employee accounts yet.')}</div>
            ) : (
              employees.map((row, index) => (
                <div key={row.id}>
                  <div className={styles.tableRow}>
                    <span>{index + 1}</span>
                    <div className={styles.tableRowUser}>
                      <div className={styles.tableAvatar}>{row.username.charAt(0).toUpperCase()}</div>
                      <span>{row.username}</span>
                    </div>
                    <span className={styles.statValue}>
                      <span className={styles.statusDot} style={row.isActive ? {} : { background: '#ef4444' }} />
                      {t(row.isActive ? 'Active' : 'Inactive')}
                    </span>
                    <span>{new Date(row.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    <div className={styles.tableActions}>
                      <button
                        type="button"
                        className={styles.outlined}
                        disabled={busy}
                        onClick={() => { setEditing(editing === row.id ? '' : row.id); setEditName(row.username); setPasswordTarget(''); }}
                      >
                        {t('Edit')}
                      </button>
                      <button
                        type="button"
                        className={styles.outlined}
                        disabled={busy}
                        onClick={() => { setPasswordTarget(passwordTarget === row.id ? '' : row.id); setEmployeePasswordDraft({ current: '', next: '', confirm: '' }); setEditing(''); }}
                      >
                        {t('Password')}
                      </button>
                      <button
                        type="button"
                        className={`${styles.outlined} ${row.isActive ? styles.danger : ''}`}
                        disabled={busy}
                        onClick={() => saveEmployee(row.id, { isActive: !row.isActive })}
                      >
                        {t(row.isActive ? 'Deactivate' : 'Activate')}
                      </button>
                    </div>
                  </div>

                  {editing === row.id ? (
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                      <form className={styles.form} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: '12px' }} onSubmit={(e) => { e.preventDefault(); saveEmployee(row.id, { username: editName }); }}>
                        <div className={styles.field}>
                          <label>{t('Username')}</label>
                          <input required minLength={3} maxLength={32} pattern="[A-Za-z][A-Za-z0-9._-]{2,31}" value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </div>
                        <button className={styles.primary} type="submit" disabled={busy}>{t('Save')}</button>
                        <button className={styles.outlined} type="button" onClick={() => setEditing('')}>{t('Cancel')}</button>
                      </form>
                    </div>
                  ) : null}

                  {passwordTarget === row.id ? (
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                      <form className={styles.form} onSubmit={changeEmployeePassword}>
                        <div className={styles.formRow}>
                          <div className={styles.field}>
                            <label>{t('Your current password')}</label>
                            <input type="password" autoComplete="current-password" minLength={8} maxLength={128} required value={employeePassword.current} onChange={(e) => setEmployeePasswordDraft(s => ({ ...s, current: e.target.value }))} />
                          </div>
                          <div className={styles.field}>
                            <label>{t('New password')}</label>
                            <input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={employeePassword.next} onChange={(e) => setEmployeePasswordDraft(s => ({ ...s, next: e.target.value }))} />
                          </div>
                          <div className={styles.field}>
                            <label>{t('Confirm password')}</label>
                            <input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={employeePassword.confirm} onChange={(e) => setEmployeePasswordDraft(s => ({ ...s, confirm: e.target.value }))} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className={styles.primary} type="submit" disabled={busy}>{t('Save password')}</button>
                          <button className={styles.outlined} type="button" onClick={() => setPasswordTarget('')}>{t('Cancel')}</button>
                        </div>
                      </form>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
