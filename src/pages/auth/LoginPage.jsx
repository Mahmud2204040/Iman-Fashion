import T from '../../components/common/LocalizedText.jsx';
import { useEffect, useId, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import Button from '../../components/common/Button/Button.jsx';
import FormField from '../../components/common/FormField/FormField.jsx';
import Input from '../../components/common/Input/Input.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { ROLES } from '../../constants/roles.js';
import loginPhoto from '../../assets/login_page_iman_fashion.png';
import logoImage from '../../assets/Logo.png';
import styles from './LoginPage.module.css';

/**
 * LoginPage — Phase 3.
 *
 * Server-backed login form.
 * - Disables submit while authenticating.
 * - Surfaces inline errors. Never reveals which of username/password was wrong.
 * - On success, redirects to the route the user originally tried to reach,
 *   or the role's landing page by default.
 */
const OWNER_ONLY_PATHS = /^\/(dashboard|products|suppliers|purchases|raw-materials|expenses|cash|reports)(\/|$)/;

function destinationFor(role, from) {
  const landing = role === ROLES.EMPLOYEE ? '/sales/new' : '/dashboard';
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) return landing;
  if (role === ROLES.EMPLOYEE && OWNER_ONLY_PATHS.test(from)) return landing;
  return from;
}

export default function LoginPage() {
  const { login, role, isAuthenticated, isLoading: authLoading } = useAuth();
  const { language, changeLanguage, t } = useLocale();
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

  // Preserve a permitted deep link, otherwise use the role's landing page.
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const target = destinationFor(role, location.state?.from);
      navigate(target, { replace: true });
    }
  }, [authLoading, isAuthenticated, role, location.state, navigate]);

  function validate() {
    const next = { username: '', password: '' };
    if (!username.trim()) next.username = t('Username is required.');
    if (!password) next.password = t('Password is required.');
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
      const signedIn = await login({ username, password, rememberMe });
      const target = destinationFor(signedIn.role, location.state?.from);
      navigate(target, { replace: true });
    } catch (err) {
      setError(err?.code === 'INVALID_CREDENTIALS'
        ? t('Invalid username or password.')
        : (err?.message || t('Unable to sign in. Please try again.')));
    } finally {
      setSubmitting(false);
    }
  }

  // While AuthProvider is restoring the session, render nothing to avoid
  // a flash redirect. ProtectedRoute already handles this for protected
  // routes; this keeps the login form consistent.
  if (authLoading) return null;

  // Belt-and-braces: if already authenticated, don't render the form.
  if (isAuthenticated) {
    return <Navigate to={destinationFor(role, location.state?.from)} replace />;
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
            <div className={styles.brandTitle}><T>IMAN FASHION</T></div>
            <a className={styles.brandSubtitle} href="#shop-management">
              {t('Shop Management')}
            </a>
            <hr className={styles.brandRule} />
            <p className={styles.brandTagline}><T>
              Manage your sales, inventory, customers,
              </T><br /><T>
              and more — all in one place.
            </T></p>
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
                <span>{t('Smart Sales')}</span>
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
                <span>{t('Inventory Control')}</span>
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
                <span>{t('Business Growth')}</span>
              </li>
            </ul>
          </div>
        </aside>

        {/* ---- Right pane: form ---- */}
        <div className={styles.formPane}>
          <select className={styles.languageSelect} aria-label="Language / ভাষা" value={language} onChange={(event) => changeLanguage(event.target.value)}>
            <option value="en"><T>English</T></option><option value="bn">বাংলা</option>
          </select>
          <div className={styles.brandHeader}>
            <img
              src={logoImage}
              alt=""
              aria-hidden="true"
              className={styles.brandLogo}
              draggable="false"
            />
            <span className={styles.brandHeaderLabel}><T>IMAN FASHION</T></span>
          </div>

          <h1 id="login-title" className={styles.title}>
            {t('Welcome back')}
          </h1>
          <p className={styles.subtitle}>{t('Sign in to continue to Iman Fashion')}</p>

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
                {t('Secure account sign-in')}
              </strong>
              <p className={styles.bannerText}>
                {t('Use the account credentials set by the Owner.')}
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
              label={t('Username')}
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
              label={t('Password')}
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
                    placeholder={t('Enter your password')}
                    className={styles.inputField}
                    {...controlProps}
                  />
                  <button
                    type="button"
                    className={styles.inputToggle}
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={t(showPassword ? 'Hide password' : 'Show password')}
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
                <span>{t('Remember me')}</span>
              </label>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={submitting}
              loadingText={t('Signing in')}
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
              {t('Sign in')}
            </Button>
          </form>

          <footer className={styles.footer}><T>
            © 2026 Iman Fashion. All rights reserved.
          </T></footer>
        </div>
      </section>
    </main>
  );
}
