import styles from './AppShell.module.css';

import logoImage from '../../assets/Logo.png';

/**
 * Brand logo for the sidebar and any future brand surfaces.
 *
 * Renders the official `Logo.png` mark on the left, with the NI Fashion
 * wordmark on the right (in full mode). The image is imported as a URL
 * via Vite so the asset is bundled and cache-friendly.
 *
 * `compact` (default false) collapses the wordmark to just the mark,
 * used by the mobile drawer header to save vertical space.
 *
 * `tone` ("dark" default / "light") flips the wordmark + sub-line colors
 * so the logo can sit on either a dark sidebar or a light page surface.
 *
 * `className` is forwarded to the outer wrapper so the consumer can
 * scope additional styling (e.g. mobile-only visibility).
 */
function Logo({ compact = false, tone = 'dark', className = '' }) {
  const toneClass = tone === 'light' ? styles.logoLight : '';
  const wrapperClass = [
    compact ? styles.logoCompact : styles.logo,
    toneClass,
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={wrapperClass}>
      <img
        src={logoImage}
        alt=""
        aria-hidden="true"
        className={styles.logoImage}
        draggable="false"
      />
      {!compact ? (
        <div className={styles.logoText}>
          <span className={styles.logoName}>NI Fashion</span>
          <span className={styles.logoSub}>Shop Management</span>
        </div>
      ) : null}
    </div>
  );
}

export default Logo;
