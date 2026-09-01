import { Link, useNavigate } from 'react-router-dom';

import Button from '../components/common/Button/Button.jsx';
import { useAuth } from '../hooks/useAuth.js';
import styles from './UnauthorizedPage.module.css';

/**
 * UnauthorizedPage — Phase 3.
 *
 * Shown when an authenticated user (typically an EMPLOYEE) hits a route
 * reserved for another role. Surfaces a clear, neutral message and a
 * path back to the dashboard. Does not leak server-side details.
 */
export default function UnauthorizedPage() {
  const navigate = useNavigate();
  const { role, logout } = useAuth();

  const handleSignOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="unauthorized-title">
        <span className={styles.badge}>403 · Restricted</span>
        <h1 id="unauthorized-title" className={styles.title}>
          Access restricted
        </h1>
        <p className={styles.body}>
          You don&rsquo;t have permission to access this page.
        </p>
        {role ? (
          <p className={styles.role}>
            Current role: <strong>{role}</strong>
          </p>
        ) : null}

        <div className={styles.actions}>
          <Link to="/dashboard">
            <Button variant="primary">Back to Dashboard</Button>
          </Link>
          <Button variant="ghost" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </section>
    </main>
  );
}