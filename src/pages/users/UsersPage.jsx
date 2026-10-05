import { useCallback, useEffect, useState } from 'react';

import { Spinner } from '../../components/common/index.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { formatCount } from '../../utils/format.js';
import { createEmployee, getEmployees, updateEmployee } from '../../services/users/userService.js';
import statusIndicator from '../../assets/figma/employee-accounts/imgStatusIndicator.svg';
import styles from './UsersPage.module.css';

const DEMO_NOTICE = 'All new employee accounts are assigned an initial password: password123. They can change it after signing in.';

export default function UsersPage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const [employees, setEmployees] = useState([]);
  const [username, setUsername] = useState('');
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setEmployees(await getEmployees({ actor: user }));
      setError('');
    } catch (err) {
      setError(err?.message || 'Could not load employees.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  async function create(event) {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      await createEmployee({ username, password: 'password123' }, { actor: user });
      setUsername('');
      setNotice('Employee account created. The initial password is password123.');
      await refresh();
    } catch (err) {
      setError(err?.message || 'Could not create employee.');
    } finally {
      setBusy(false);
    }
  }

  async function save(row, patch) {
    setBusy(true); setError(''); setNotice('');
    try {
      await updateEmployee(row.id, patch);
      setEditing(null);
      setNotice('Employee account updated.');
      await refresh();
    } catch (err) {
      setError(err?.message || 'Could not update employee.');
    } finally {
      setBusy(false);
    }
  }

  const [noticeBeforePassword, noticeAfterPassword] = t(DEMO_NOTICE).split('password123');

  return (
    <main className={styles.page}>
      <header className={styles.pageHeading}>
        <span className={styles.eyebrow}>{t('Owner settings')}</span>
        <h1>{t('Employee accounts')}</h1>
        <p>{t('Create employee accounts and manage who can sign in.')}</p>
      </header>

      {error && <div role="alert" className={styles.error}>{t(error)} <button type="button" onClick={refresh}>{t('Retry')}</button></div>}
      {notice && <div role="status" className={styles.notice}>{t(notice)}</div>}

      <section className={styles.panel} aria-label={t('Employee accounts')}>
        <div className={styles.createSection}>
          <div className={styles.createBody}>
            <div className={styles.sectionIntro}>
              <h2>{t('Add employee')}</h2>
              <p>{t('Choose a username for the new demo account.')}</p>
            </div>
            <form className={styles.createForm} onSubmit={create}>
              <label htmlFor="new-employee-username">{t('Username')}</label>
              <div className={styles.createControls}>
                <input
                  id="new-employee-username"
                  required minLength={3} maxLength={32}
                  pattern="[A-Za-z][A-Za-z0-9._-]{2,31}"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder={t('e.g. sales.team')}
                  autoComplete="off"
                />
                <button type="submit" className={styles.primaryAction} disabled={busy}>
                  <span aria-hidden="true">＋</span>{t('Create account')}
                </button>
              </div>
            </form>
          </div>
          <aside className={styles.demoNotice}>
            <div className={styles.demoNoticeTitle}><span aria-hidden="true" className={styles.infoMark}>i</span>{t('Demo accounts only')}</div>
            <p>{noticeBeforePassword}<strong>password123</strong>{noticeAfterPassword}</p>
          </aside>
        </div>

        <div className={styles.roster} aria-busy={loading}>
          <div className={styles.rosterHeading}>
            <h2>{t('Employees')}</h2>
            <span className={styles.countBadge}>{formatCount(employees.length, 'account', 'accounts', 'অ্যাকাউন্ট')}</span>
          </div>
          <div className={styles.tableHeader} aria-hidden="true">
            <span>{t('Username')}</span><span>{t('Account status')}</span><span>{t('Actions')}</span>
          </div>
          {loading ? (
            <div className={styles.loading}><Spinner size="sm" />{t('Loading employees…')}</div>
          ) : employees.length === 0 ? (
            <p className={styles.empty}>{t('No employee accounts yet.')}</p>
          ) : (
            <ul className={styles.list}>
              {employees.map((row) => (
                <li key={row.id} className={styles.row}>
                  <div className={styles.identity}>
                    <span className={styles.avatar} aria-hidden="true">{row.username.charAt(0).toUpperCase()}</span>
                    {editing === row.username ? (
                      <form id={`edit-${row.username}`} className={styles.editForm} onSubmit={(event) => { event.preventDefault(); save(row, { username: editName }); }}>
                        <label className={styles.srOnly} htmlFor={`user-${row.username}`}>{t('Edit username')}</label>
                        <input id={`user-${row.username}`} value={editName} onChange={(event) => setEditName(event.target.value)} required minLength={3} maxLength={32} pattern="[A-Za-z][A-Za-z0-9._-]{2,31}" />
                      </form>
                    ) : <strong>{row.username}</strong>}
                  </div>
                  <div className={styles.status}>
                    <span className={`${styles.statusBadge} ${row.isActive ? styles.active : styles.inactive}`}>
                      {row.isActive ? <img src={statusIndicator} alt="" /> : <span className={styles.inactiveDot} aria-hidden="true" />}
                      {t(row.isActive ? 'Active' : 'Inactive')}
                    </span>
                    <span className={styles.statusDetail}>{t(row.isActive ? 'can sign in' : 'sign-in blocked')}</span>
                  </div>
                  <div className={styles.actions}>
                    {editing === row.username ? (
                      <>
                        <button type="submit" form={`edit-${row.username}`} className={styles.secondaryAction} disabled={busy}>{t('Save')}</button>
                        <button type="button" className={styles.secondaryAction} onClick={() => setEditing(null)}>{t('Cancel')}</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className={styles.secondaryAction} onClick={() => { setEditing(row.username); setEditName(row.username); }}>{t('Edit')}</button>
                        <button type="button" className={row.isActive ? styles.dangerAction : styles.secondaryAction} disabled={busy} onClick={() => save(row, { isActive: !row.isActive })}>{t(row.isActive ? 'Deactivate' : 'Activate')}</button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className={styles.rosterFooter}>{t('Deactivating an account prevents that employee from signing in.')}</p>
        </div>
      </section>
    </main>
  );
}
