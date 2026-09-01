import { ArrowDownIcon, ArrowUpIcon } from '../../../icons/DashboardIcon.jsx';
import {
  formatCurrency,
  formatDelta,
  formatNumber,
} from '../../../../utils/format.js';
import styles from './StatCard.module.css';

/**
 * StatCard — a single KPI tile on the dashboard.
 *
 * Visual contract:
 *   - Icon badge in a tinted gradient (top-left) acts as a glanceable
 *     visual anchor.
 *   - Label sits below the badge in muted small-caps style.
 *   - Value is the focal point: large, tabular numerals, bold.
 *   - Delta chip sits to the right of the value, color-coded by sign.
 *   - Sparkline at the bottom shows the last 7 days as a 7-bar chart.
 *     This is intentionally minimal — just enough to suggest momentum.
 *
 * Props
 *   icon       Component   Required. SVG icon component (1x stroke).
 *   label      string      Required. Short label, e.g. "Today's sales".
 *   value      number      Required. Raw numeric value.
 *   kind       string      One of 'currency' | 'number' | 'plain'.
 *                          Defaults to 'currency' for the dashboard.
 *   delta      number      Optional. Fraction (0.124 = +12.4%) vs yesterday.
 *   trend      number[7]   Optional. Seven normalised (0..1) values for
 *                          the sparkline.
 *   accent     string      Optional. Tint for the icon badge gradient.
 *                          Defaults to the brand indigo.
 *   emphasis   string      Optional. 'normal' | 'highlight'. Highlight
 *                          adds a subtle gradient border to the card.
 */
function StatCard({
  icon: Icon,
  label,
  value,
  kind = 'currency',
  delta,
  trend,
  accent,
  emphasis = 'normal',
}) {
  let valueText;
  if (kind === 'currency') {
    valueText = formatCurrency(value);
  } else if (kind === 'number') {
    valueText = formatNumber(value);
  } else {
    valueText = String(value);
  }

  const hasDelta = typeof delta === 'number' && Number.isFinite(delta);
  const trendUp = hasDelta && delta >= 0;
  const TrendIcon = trendUp ? ArrowUpIcon : ArrowDownIcon;

  const cardClassName = [
    styles.card,
    emphasis === 'highlight' ? styles.cardHighlight : '',
  ]
    .filter(Boolean)
    .join(' ');

  const badgeClassName = [
    styles.badge,
    accent ? styles[`badge-${accent}`] : styles.badgeBrand,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article className={cardClassName}>
      <div className={styles.head}>
        <span className={badgeClassName} aria-hidden="true">
          {Icon ? <Icon size={20} strokeWidth={1.75} /> : null}
        </span>
        <span className={styles.label}>{label}</span>
      </div>

      <div className={styles.valueRow}>
        <span className={styles.value}>{valueText}</span>
        {hasDelta ? (
          <span
            className={`${styles.delta} ${
              trendUp ? styles.deltaUp : styles.deltaDown
            }`}
          >
            <TrendIcon size={12} strokeWidth={2.25} />
            {formatDelta(delta)}
          </span>
        ) : null}
      </div>

      {Array.isArray(trend) && trend.length > 0 ? (
        <Sparkline
          data={trend}
          tone={trendUp ? 'up' : 'down'}
          accent={accent}
        />
      ) : null}
    </article>
  );
}

/**
 * Sparkline — pure inline SVG, 7 bars.
 *
 * Data is expected to be normalised 0..1. The component scales the bar
 * heights to fit the viewBox. The last bar is coloured to draw the eye
 * to "today".
 */
function Sparkline({ data, tone, accent }) {
  const W = 100;
  const H = 28;
  const barWidth = 8;
  const gap = (W - barWidth * data.length) / (data.length - 1);
  const max = Math.max(...data, 1);

  const toneClass =
    tone === 'up'
      ? accent
        ? styles.sparkBarAccent
        : styles.sparkBarUp
      : styles.sparkBarDown;

  return (
    <svg
      className={styles.spark}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {data.map((v, i) => {
        const h = Math.max(2, (v / max) * (H - 4));
        const x = i * (barWidth + gap);
        const y = H - h;
        const isLast = i === data.length - 1;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={h}
            rx={1.5}
            ry={1.5}
            className={`${styles.sparkBar} ${toneClass} ${
              isLast ? styles.sparkBarLast : ''
            }`}
          />
        );
      })}
    </svg>
  );
}

export default StatCard;