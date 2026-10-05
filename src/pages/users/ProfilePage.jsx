import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Spinner } from '../../components/common/index.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { createEmployee, getEmployees, setEmployeePassword, setOwnPassword, setOwnUsername, updateEmployee } from '../../services/users/userService.js';
import styles from './ProfilePage.module.css';

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
  const [own, setOwn] = useState({ current: '', next: '', confirm: '' });
  const [ownUsername, setOwnUsernameState] = useState({ currentPassword: '', newUsername: '' });
  const [newEmployee, setNewEmployee] = useState({ username: '', password: '', confirm: '' });
  const [editing, setEditing] = useState('');
  const [editName, setEditName] = useState('');
  const [passwordTarget, setPasswordTarget] = useState('');
  const [employeePassword, setEmployeePasswordDraft] = useState({ current: '', next: '', confirm: '' });

  const refresh = useCallback(async () => {
    if (!isOwner) return;
    setLoading(true);
    try { setEmployees(await getEmployees()); }
    catch (caught) { setError(caught?.message || 'Could not load employees.'); }
    finally { setLoading(false); }
  }, [isOwner]);

  useEffect(() => { refresh(); }, [refresh]);

  function beginAction() { setError(''); setNotice(''); setBusy(true); }

  
  async function changeUsername(event) {
    event.preventDefault();
    if (!ownUsername.newUsername || ownUsername.newUsername === user?.username) return;
    beginAction();
    try {
      await setOwnUsername(ownUsername.currentPassword, ownUsername.newUsername);
      setOwnUsernameState({ currentPassword: '', newUsername: '' });
      setNotice('Username updated correctly. Please log in again.');
      setTimeout(() => logout(), 2000);
    } catch (caught) {
      setError(caught?.message || 'Could not update username.');
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
    } catch (caught) { setError(caught?.message || 'Could not update password.'); }
    finally { setBusy(false); }
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
    } catch (caught) { setError(caught?.message || 'Could not create employee.'); }
    finally { setBusy(false); }
  }

  async function saveEmployee(id, patch) {
    beginAction();
    try {
      await updateEmployee(id, patch);
      setEditing('');
      setNotice('Employee account updated.');
      await refresh();
    } catch (caught) { setError(caught?.message || 'Could not update employee.'); }
    finally { setBusy(false); }
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
    } catch (caught) { setError(caught?.message || 'Could not update password.'); }
    finally { setBusy(false); }
  }

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <h1>{t('Account & Users')}</h1>
        </div>
      </header>

      {notice ? <p className={styles.notice} role="status">{t(notice)}</p> : null}
      {error ? <p className={styles.error} role="alert">{t(error)}</p> : null}

      <section className={styles.section}>
        <h2>{t('Change username')}</h2>
        <p className={styles.helpText}>{t('Your current name is:')} <strong>{user?.name || user?.username}</strong>, {t('and your username is:')} <strong>{user?.username}</strong>. {t('You will be logged out after changing your username.')}</p>
        <form className={styles.inlineForm} onSubmit={changeUsername}>
          <label>
            {t('Current password')}
            <input type="password" required value={ownUsername.currentPassword} onChange={(e) => setOwnUsernameState(c => ({ ...c, currentPassword: e.target.value }))} />
          </label>
          <label>
            {t('New username')}
            <input required minLength={3} maxLength={32} pattern="[A-Za-z][A-Za-z0-9._-]{2,31}" value={ownUsername.newUsername} onChange={(e) => setOwnUsernameState(c => ({ ...c, newUsername: e.target.value }))} />
          </label>
          <button className={styles.primary} type="submit" disabled={busy}>{t('Update username')}</button>
        </form>
      </section>

      <section className={styles.section}>
        <h2>{t('Change password')}</h2>
        <form className={styles.inlineForm} onSubmit={changeOwnPassword}>
          <label>
            {t('Current password')}
            <input type="password" autoComplete="current-password" minLength={8} maxLength={128} required value={own.current} onChange={(event) => setOwn((current) => ({ ...current, current: event.target.value }))} />
          </label>
          <label>
            {t('New password')}
            <input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={own.next} onChange={(event) => setOwn((current) => ({ ...current, next: event.target.value }))} />
          </label>
          <label>
            {t('Confirm password')}
            <input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={own.confirm} onChange={(event) => setOwn((current) => ({ ...current, confirm: event.target.value }))} />
          </label>
          <button className={styles.primary} type="submit" disabled={busy}>{t('Update password')}</button>
        </form>
      </section>

      <section className={styles.section}>
        <h2>{t('System accounts')}</h2>
        <form className={styles.createForm} onSubmit={create}>
          <h3>{t('Add employee')}</h3>
          <div className={styles.createGrid}>
            <label>{t('Username')}<input required minLength={3} maxLength={32} pattern="[A-Za-z][A-Za-z0-9._-]{2,31}" autoComplete="off" value={newEmployee.username} onChange={(event) => setNewEmployee((current) => ({ ...current, username: event.target.value }))} /></label>
            <label>{t('Password')}<input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={newEmployee.password} onChange={(event) => setNewEmployee((current) => ({ ...current, password: event.target.value }))} /></label>
            <label>{t('Confirm password')}<input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={newEmployee.confirm} onChange={(event) => setNewEmployee((current) => ({ ...current, confirm: event.target.value }))} /></label>
          </div>
          <div className={styles.formFooter}><small>{t('Use 8-128 characters. Passwords are never shown after saving.')}</small><button className={styles.primary} type="submit" disabled={busy}>{t('Create account')}</button></div>
        </form>
        
        <div className={styles.roster} aria-busy={loading}>
          {loading ? <div className={styles.loading}><Spinner size="sm" />{t('Loading employees...')}</div> : employees.length === 0 ? <p className={styles.empty}>{t('No employee accounts yet.')}</p> : employees.map((row) => (
            <div className={styles.employeeRow} key={row.id}>
              <div className={styles.employeeIdentity}>
                <span className={styles.smallAvatar}>{row.username.charAt(0).toUpperCase()}</span>
                <div>
                  <strong>{row.username}</strong>
                  <small className={row.isActive ? styles.active : styles.inactive}>{t(row.isActive ? 'Active' : 'Inactive')}</small>
                </div>
              </div>
              <div className={styles.rowActions}>
                <button type="button" disabled={busy} onClick={() => { setEditing(editing === row.id ? '' : row.id); setEditName(row.username); setPasswordTarget(''); }}>{t('Edit username')}</button>
                <button type="button" disabled={busy} onClick={() => { setPasswordTarget(passwordTarget === row.id ? '' : row.id); setEmployeePasswordDraft({ current: '', next: '', confirm: '' }); setEditing(''); }}>{t('Set password')}</button>
                <button type="button" className={row.isActive ? styles.danger : ''} disabled={busy} onClick={() => saveEmployee(row.id, { isActive: !row.isActive })}>{t(row.isActive ? 'Deactivate' : 'Activate')}</button>
              </div>
              
              {editing === row.id ? (
                <form className={styles.inlineForm} onSubmit={(event) => { event.preventDefault(); saveEmployee(row.id, { username: editName }); }}>
                  <label>{t('Username')}<input required minLength={3} maxLength={32} pattern="[A-Za-z][A-Za-z0-9._-]{2,31}" value={editName} onChange={(event) => setEditName(event.target.value)} /></label>
                  <button className={styles.primary} type="submit" disabled={busy}>{t('Save')}</button>
                  <button type="button" onClick={() => setEditing('')}>{t('Cancel')}</button>
                </form>
              ) : null}
              
              {passwordTarget === row.id ? (
                <form className={styles.inlineForm} onSubmit={changeEmployeePassword}>
                  <label>{t('Your current password')}<input type="password" autoComplete="current-password" minLength={8} maxLength={128} required value={employeePassword.current} onChange={(event) => setEmployeePasswordDraft((current) => ({ ...current, current: event.target.value }))} /></label>
                  <label>{t('New password')}<input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={employeePassword.next} onChange={(event) => setEmployeePasswordDraft((current) => ({ ...current, next: event.target.value }))} /></label>
                  <label>{t('Confirm password')}<input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={employeePassword.confirm} onChange={(event) => setEmployeePasswordDraft((current) => ({ ...current, confirm: event.target.value }))} /></label>
                  <button className={styles.primary} type="submit" disabled={busy}>{t('Save password')}</button>
                  <button type="button" onClick={() => setPasswordTarget('')}>{t('Cancel')}</button>
                </form>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
