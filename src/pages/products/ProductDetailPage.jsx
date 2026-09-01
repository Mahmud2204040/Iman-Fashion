/**
 * ProductDetailPage — Phase 8.
 *
 * Owner-only. Shows product profile + stock-adjustment form +
 * recent stock history. Stock is shown as a plain number per
 * Phase 8 spec (no colour bands / thresholds).
 *
 * The adjust-stock form enforces:
 *   - non-zero delta
 *   - required reason (free text, 120 char limit)
 *   - reason preset chips for convenience (OPENING_STOCK,
 *     sold, damaged, return, custom-order, transfer) — but
 *     the underlying value is free text.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

import {
  Badge,
  Button,
  Card,
  FormField,
  Input,
  PageHeader,
  Spinner,
  Textarea,
} from '../../components/common/index.js';
import { ProductIcon } from '../../components/icons/DashboardIcon.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import {
  adjustStock,
  getProductById,
  getStockHistory,
} from '../../services/products/productService.js';
import { formatCurrency, timeAgo } from '../../utils/format.js';
import styles from './ProductDetailPage.module.css';

const REASON_PRESETS = [
  'OPENING_STOCK',
  'Sold to retail customer',
  'Sold via sale',
  'Reserved for custom order',
  'Returned / exchange',
  'Damaged in shop',
  'Stock count correction',
  'Transfer between locations',
];

export default function ProductDetailPage() {
  const { id } = useParams();
  const { user, role } = useAuth();
  const isOwner = role === 'OWNER';

  const [product, setProduct] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [delta, setDelta] = useState('1');
  const [reason, setReason] = useState('Sold to retail customer');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const [pendingSign, setPendingSign] = useState(null); // '+' | '-'

  function reload() {
    setLoading(true);
    setError('');
    Promise.all([getProductById(id), getStockHistory(id)])
      .then(([p, h]) => {
        setProduct(p);
        setHistory(h);
      })
      .catch((err_) => setError(err_?.message || 'Could not load product.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const totalStock = useMemo(() => {
    if (!product) return 0;
    return (history || []).reduce((s, r) => s + Number(r.delta || 0), 0);
  }, [product, history]);

  if (loading) {
    return (
      <main className={styles.page} aria-busy="true">
        <div className={styles.loading}>
          <Spinner /> <span>Loading product…</span>
        </div>
      </main>
    );
  }

  if (error || !product) {
    return <Navigate to="/products" replace />;
  }

  const currentSign = pendingSign === '-' ? -1 : pendingSign === '+' ? 1 : 1;
  const pendingDelta = currentSign * (Number(delta) || 0);
  const projectedStock = totalStock + pendingDelta;
  const wouldGoNegative = projectedStock < 0;

  async function performAdjust() {
    setBusy(true);
    setFormError('');
    try {
      const signedDelta = pendingSign === '-' ? -Math.abs(Number(delta) || 0) : Math.abs(Number(delta) || 0);
      await adjustStock(
        product.id,
        { delta: signedDelta, reason, note },
        { actor: { username: user?.username || 'unknown', role } },
      );
      setPendingSign(null);
      setDelta('1');
      setNote('');
      reload();
    } catch (err_) {
      setFormError(err_?.message || 'Could not adjust stock.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <Link to="/products" className={styles.backLink}>
        ← All products
      </Link>

      <PageHeader
        eyebrow={product.category || 'Inventory'}
        title={product.name}
        description={`${product.sku} · updated ${timeAgo(product.updatedAt)}`}
        actions={
          <Badge tone={product.isActive ? 'success' : 'neutral'}>
            {product.isActive ? 'Active' : 'Inactive'}
          </Badge>
        }
      />

      <div className={styles.summary}>
        <Card className={styles.stockCard}>
          <div className={styles.stockIcon}>
            <ProductIcon size={20} strokeWidth={1.7} />
          </div>
          <div className={styles.stockMeta}>
            <span className={styles.stockLabel}>Current stock</span>
            <span className={styles.stockNumber}>{totalStock}</span>
            <span className={styles.stockFootnote}>
              Across {history.length} ledger {history.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>
        </Card>

        <Card className={styles.priceCard}>
          <span className={styles.cellLabel}>Sale price</span>
          <strong className={styles.priceValue}>{formatCurrency(product.price)}</strong>
          <span className={styles.cellLabel}>SKU</span>
          <span className={styles.sku}>{product.sku}</span>
        </Card>

        <Card className={styles.metaCard}>
          <span className={styles.cellLabel}>Created</span>
          <strong>{timeAgo(product.createdAt)}</strong>
          <span className={styles.cellLabel}>By</span>
          <span className={styles.cellValue}>{product.createdBy || 'unknown'}</span>
        </Card>
      </div>

      {product.description ? (
        <Card>
          <h2 className={styles.sectionTitle}>Description</h2>
          <p className={styles.desc}>{product.description}</p>
        </Card>
      ) : null}

      {isOwner ? (
        <Card className={styles.adjustCard}>
          <h2 className={styles.sectionTitle}>Adjust stock</h2>
          <p className={styles.adjustHint}>
            Quantity change is signed: <strong>+</strong> adds to stock,
            <strong> −</strong> removes. A reason is required (free text).{' '}
            <code>OPENING_STOCK</code> is the only structured shortcut.
          </p>

          <div className={styles.signRow} role="tablist" aria-label="Adjustment direction">
            <button
              type="button"
              role="tab"
              aria-selected={pendingSign !== '-'}
              className={[styles.signBtn, pendingSign !== '-' ? styles.signActive : ''].join(' ')}
              onClick={() => setPendingSign('+')}
            >
              + Add stock
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={pendingSign === '-'}
              className={[styles.signBtn, pendingSign === '-' ? styles.signActive : ''].join(' ')}
              onClick={() => setPendingSign('-')}
            >
              − Remove stock
            </button>
          </div>

          <div className={styles.adjustGrid}>
            <FormField label="Quantity" htmlFor="adj-qty">
              <Input
                id="adj-qty"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Reason" htmlFor="adj-reason" required>
              <Input
                id="adj-reason"
                placeholder="Free text — required"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={120}
                required
              />
            </FormField>
          </div>

          <div className={styles.presetRow} aria-label="Reason presets">
            {REASON_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={[
                  styles.preset,
                  reason === preset ? styles.presetActive : '',
                ].join(' ')}
                onClick={() => setReason(preset)}
              >
                {preset}
              </button>
            ))}
          </div>

          <FormField label="Note" htmlFor="adj-note" hint="Optional — added to the ledger entry.">
            <Textarea
              id="adj-note"
              rows={2}
              placeholder="e.g. Walk-in customer 2025-09-14"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </FormField>

          <div className={styles.preview}>
            <span>
              Change:{' '}
              <strong className={pendingSign === '-' ? styles.previewNeg : styles.previewPos}>
                {pendingSign === '-' ? '−' : '+'}
                {Math.abs(pendingDelta || Number(delta) || 0)}
              </strong>
            </span>
            <span>
              Projected stock:{' '}
              <strong className={wouldGoNegative ? styles.previewNeg : styles.previewPos}>
                {projectedStock}
              </strong>
            </span>
          </div>

          {formError ? (
            <p className={styles.formError} role="alert">
              {formError}
            </p>
          ) : null}

          <div className={styles.adjustActions}>
            <Button
              type="button"
              variant="primary"
              disabled={busy}
              onClick={() => {
                if (pendingSign === null) setPendingSign('+');
                setFormError('');
                if (wouldGoNegative) {
                  setFormError('Adjustment would drive stock negative.');
                  return;
                }
                if (!reason.trim()) {
                  setFormError('Reason is required.');
                  return;
                }
                if (!delta || Number(delta) === 0) {
                  setFormError('Quantity must be a positive number.');
                  return;
                }
                setPendingSign(pendingSign === '-' ? '-' : '+');
                performAdjust();
              }}
            >
              {busy ? 'Saving…' : `Apply ${pendingSign === '-' ? '−' : '+'}${Math.abs(Number(delta) || 0)} to stock`}
            </Button>
          </div>
        </Card>
      ) : null}

      <Card>
        <h2 className={styles.sectionTitle}>Stock history</h2>
        {history.length === 0 ? (
          <p className={styles.empty}>No stock changes yet.</p>
        ) : (
          <ul className={styles.history}>
            {history.map((h) => (
              <li key={h.id} className={styles.histRow}>
                <span
                  className={[
                    styles.delta,
                    h.delta >= 0 ? styles.deltaPos : styles.deltaNeg,
                  ].join(' ')}
                >
                  {h.delta >= 0 ? '+' : ''}
                  {h.delta}
                </span>
                <div className={styles.histMain}>
                  <strong>{h.reason}</strong>
                  {h.note ? <span className={styles.histNote}>{h.note}</span> : null}
                  <span className={styles.histMeta}>
                    {timeAgo(h.createdAt)} · by {h.createdBy || 'unknown'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

    </main>
  );
}
