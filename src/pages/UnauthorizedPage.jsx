import T from '../components/common/LocalizedText.jsx';
import { Link, useNavigate } from 'react-router-dom';

import Button from '../components/common/Button/Button.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { ROLES } from '../constants/roles.js';
import styles from './UnauthorizedPage.module.css';

/**
 * UnauthorizedPage — Phase 3.
 *
 * Shown when an authenticated user (typically an EMPLOYEE) hits a route
 * reserved for another role. Surfaces a clear, neutral message and a
 * path back to the role's landing page. Does not leak server-side details.
 */
export default function UnauthorizedPage() {
  const navigate = useNavigate();
  const { role, logout } = useAuth();
  const homePath = role === ROLES.EMPLOYEE ? '/sales/new' : '/dashboard';

  const handleSignOut = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      window.alert('Could not sign out. Check the API connection and try again.');
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="unauthorized-title">
        <span className={styles.badge}><T>403 · Restricted</T></span>
        <h1 id="unauthorized-title" className={styles.title}><T>
          Access restricted
        </T></h1>
        <p className={styles.body}><T>
          You don&rsquo;t have permission to access this page.
        </T></p>
        {role ? (
          <p className={styles.role}><T>
            Current role: </T><strong>{role}</strong>
          </p>
        ) : null}

        <div className={styles.actions}>
          <Link to={homePath}>
            <Button variant="primary">{role === ROLES.EMPLOYEE ? 'New Sale' : 'Back to Dashboard'}</Button>
          </Link>
          <Button variant="ghost" onClick={handleSignOut}><T>
            Sign out
          </T></Button>
        </div>
      </section>
    </main>
  );
}
