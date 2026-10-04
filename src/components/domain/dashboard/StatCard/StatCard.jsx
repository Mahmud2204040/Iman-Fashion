import { Link } from 'react-router-dom';

import { useLocale } from '../../../../contexts/LocaleContext.jsx';
import { formatCurrency, formatNumber } from '../../../../utils/format.js';
import styles from './StatCard.module.css';

function StatCard({ label, value, kind = 'currency', context, to }) {
  const { t } = useLocale();
  const valueText = kind === 'currency'
    ? formatCurrency(value)
    : kind === 'number'
      ? formatNumber(value)
      : String(value);

  const content = (
    <>
      <span className={styles.label}>{t(label)}</span>
      <strong className={styles.value}>{valueText}</strong>
      {context ? <span className={styles.context}>{t(context)}</span> : null}
    </>
  );

  return to
    ? <Link className={styles.card} to={to} aria-label={t(label)}>{content}</Link>
    : <article className={styles.card}>{content}</article>;
}

export default StatCard;
