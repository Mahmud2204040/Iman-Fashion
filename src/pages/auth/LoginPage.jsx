import { useEffect, useId, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import Button from '../../components/common/Button/Button.jsx';
import FormField from '../../components/common/FormField/FormField.jsx';
import Input from '../../components/common/Input/Input.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import loginPhoto from '../../assets/login_page photo.png';
import logoImage from '../../assets/Logo.png';
import styles from './LoginPage.module.css';

/**
 * LoginPage — Phase 3.
 *
 * Mock login form. Two valid credential pairs:
 *   owner    / 1234   → OWNER
 *   employee / 1234   → EMPLOYEE
 *
 * - Disables submit while authenticating.
 * - Surfaces inline errors. Never reveals which of username/password was wrong.
 * - On success, redirects to the route the user originally tried to reach,
 *   or /dashboard by default.
 */
export default function LoginPage() {
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const usernameId = useId();
  const passwordId = useId();
  const rememberId = useId();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Field-level errors for empty-field validation.
  const [fieldErrors, setFieldErrors] = useState({ username: '', password: '' });

  // If the user is already authenticated, bounce them straight to the dashboard
  // (or back to wherever they came from). Per Phase 3 §15.
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const target =
        (location.state && location.state.from) || '/dashboard';
      navigate(target, { replace: true });
    }
  }, [authLoading, isAuthenticated, location.state, navigate]);

  function validate() {
    const next = { username: '', password: '' };
    if (!username.trim()) next.username = 'Username is required.';
    if (!password) next.password = 'Password is required.';
    setFieldErrors(next);
    return !next.username && !next.password;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setError('');

    if (!validate()) return;

    setSubmitting(true);
    try {
      await login({ username, password, rememberMe });
      const target = (location.state && location.state.from) || '/dashboard';
      navigate(target, { replace: true });
    } catch (err) {
      // Generic message per Phase 3 §8. The service's error codes
      // (EMPTY_USERNAME / EMPTY_PASSWORD / INVALID_CREDENTIALS) never
      // surface to the user, so we don't accidentally reveal which
      // field was wrong.
      setError(
        err && err.message
          ? 'Invalid username or password.'
          : 'Unable to sign in. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function applyQuickLogin(name) {
    setUsername(name);
    setPassword('1234');
    setError('');
    setFieldErrors({ username: '', password: '' });
  }

  // While AuthProvider is restoring the session, render nothing to avoid
  // a flash redirect. ProtectedRoute already handles this for protected
  // routes; this keeps the login form consistent.
  if (authLoading) return null;

  // Belt-and-braces: if already authenticated, don't render the form.
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell} aria-labelledby="login-title">
        {/* ---- Left pane: brand photo + intro ---- */}
        <aside className={styles.intro} aria-hidden="true">
          <img
            src={loginPhoto}
            alt=""
            className={styles.introImage}
            draggable="false"
          />
          <div className={styles.introOverlay} />
          <div className={styles.introContent}>
            <div className={styles.brandTitle}>NI FASHION</div>
            <a className={styles.brandSubtitle} href="#shop-management">
              Shop Management
            </a>
            <hr className={styles.brandRule} />
            <p className={styles.brandTagline}>
              Manage your sales, inventory, customers,
              <br />
              and more — all in one place.
            </p>
            <ul className={styles.featureList}>
              <li className={styles.featureItem}>
                <svg
                  className={styles.featureIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
                <span>Smart Sales</span>
              </li>
              <li className={styles.featureItem}>
                <svg
                  className={styles.featureIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 8 12 3 3 8v8l9 5 9-5V8z" />
                  <path d="M3.27 8 12 13l8.73-5" />
                  <path d="M12 22V13" />
                </svg>
                <span>Inventory Control</span>
              </li>
              <li className={styles.featureItem}>
                <svg
                  className={styles.featureIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 21h18" />
                  <path d="M6 17V9h12v8" />
                  <path d="M9 9V5h6v4" />
                  <path d="M9 13l3 3 3-3" />
                </svg>
                <span>Business Growth</span>
              </li>
            </ul>
          </div>
        </aside>

        {/* ---- Right pane: form ---- */}
        <div className={styles.formPane}>
          <div className={styles.brandHeader}>
            <img
              src={logoImage}
              alt=""
              aria-hidden="true"
              className={styles.brandLogo}
              draggable="false"
            />
            <span className={styles.brandHeaderLabel}>NI FASHION</span>
          </div>

          <h1 id="login-title" className={styles.title}>
            Welcome back
          </h1>
          <p className={styles.subtitle}>Sign in to continue to your dashboard</p>

          <div className={styles.banner} role="note">
            <svg
              className={styles.bannerIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <div className={styles.bannerBody}>
              <strong className={styles.bannerTitle}>
                Development mock authentication
              </strong>
              <p className={styles.bannerText}>
                Real authentication is not connected yet.
                <br />
                This will be replaced once the backend is ready.
              </p>
            </div>
          </div>

          {error ? (
            <div className={styles.formError} role="alert">
              {error}
            </div>
          ) : null}

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <FormField
              label="Username"
              htmlFor={usernameId}
              required
              error={fieldErrors.username}
            >
              {(controlProps) => (
                <div className={styles.inputWrap}>
                  <svg
                    className={styles.inputIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21a8 8 0 0 1 16 0" />
                  </svg>
                  <Input
                    id={usernameId}
                    name="username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    invalid={Boolean(fieldErrors.username)}
                    disabled={submitting}
                    placeholder="owner or employee"
                    autoFocus
                    className={styles.inputField}
                    {...controlProps}
                  />
                </div>
              )}
            </FormField>

            <FormField
              label="Password"
              htmlFor={passwordId}
              required
              error={fieldErrors.password}
            >
              {(controlProps) => (
                <div className={styles.inputWrap}>
                  <svg
                    className={styles.inputIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="4" y="11" width="16" height="10" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                  <Input
                    id={passwordId}
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    invalid={Boolean(fieldErrors.password)}
                    disabled={submitting}
                    placeholder="1234"
                    className={styles.inputField}
                    {...controlProps}
                  />
                  <button
                    type="button"
                    className={styles.inputToggle}
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    disabled={submitting}
                    tabIndex={0}
                  >
                    {showPassword ? (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M3 3l18 18" />
                        <path d="M10.6 10.6a3 3 0 0 0 4 4" />
                        <path d="M9.9 5.1A10 10 0 0 1 12 5c5 0 9 4 10 7a13 13 0 0 1-3.4 4.7" />
                        <path d="M6.6 6.6C4.1 8.3 2.3 10.7 2 12c1 3 5 7 10 7a10 10 0 0 0 4-.8" />
                      </svg>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              )}
            </FormField>

            <div className={styles.row}>
              <label className={styles.remember} htmlFor={rememberId}>
                <input
                  id={rememberId}
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={submitting}
                />
                <span>Remember me</span>
              </label>
              <a
                className={styles.forgotLink}
                href="#forgot-password"
                onClick={(e) => e.preventDefault()}
              >
                Forgot password?
              </a>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={submitting}
              loadingText="Signing in"
              disabled={submitting}
              className={styles.submitButton}
              leftIcon={
                <svg
                  className={styles.submitIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
              }
            >
              Sign in
            </Button>
          </form>

          <div className={styles.divider}>
            <span className={styles.dividerLine} />
            <span className={styles.dividerText}>OR</span>
            <span className={styles.dividerLine} />
          </div>

          <div className={styles.quickLogin}>
            <div className={styles.quickLoginLabel}>Quick login</div>
            <div className={styles.quickLoginRow}>
              <button
                type="button"
                className={styles.quickLoginPill}
                onClick={() => applyQuickLogin('owner')}
                disabled={submitting}
              >
                <svg
                  className={styles.quickLoginIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21a8 8 0 0 1 16 0" />
                </svg>
                <span>owner / 1234</span>
              </button>
              <button
                type="button"
                className={styles.quickLoginPill}
                onClick={() => applyQuickLogin('employee')}
                disabled={submitting}
              >
                <svg
                  className={styles.quickLoginIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21a8 8 0 0 1 16 0" />
                </svg>
                <span>employee / 1234</span>
              </button>
            </div>
          </div>

          <footer className={styles.footer}>
            © 2026 NI Fashion. All rights reserved.
          </footer>
        </div>
      </section>
    </main>
  );
}
