import T from '../../components/common/LocalizedText.jsx';
/**
 * NewSalePage — Phase 5.
 *
 * Three-pane layout on desktop, stacked on mobile.
 *
 * Flow:
 *   1. Required customer search or quick-create.
 *   2. Product search → add to cart → pick qty + price in cart.
 *      Same product re-added merges qty.
 *   3. Review cart (itemised table + total).
 *   4. Complete → success modal with the generated sales_code.
 *
 * Per FRONTEND_PLAN.md Phase 5:
 *   - Price validation: numeric and strictly greater than zero.
 *   - Sale creates a CASH_IN row with reference_type: SALE (handled
 *     inside salesService.completeSale).
 *   - sales_code format S-YYYYMMDD-NNNN generated on complete.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth.js';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import CustomerCreateFields from '../../components/customers/CustomerCreateFields.jsx';
import { useCustomerDraft } from '../../components/customers/useCustomerDraft.js';
import { Button } from '../../components/common/index.js';
import { FormField } from '../../components/common/index.js';
import { Input } from '../../components/common/index.js';
import { Modal } from '../../components/common/index.js';
import { Spinner } from '../../components/common/index.js';
import { EmptyState } from '../../components/common/index.js';
import {
  BoxIcon,
  CustomerIcon,
  ProductIcon,
  SaleIcon,
  SparklesIcon,
} from '../../components/icons/DashboardIcon.jsx';

import {
  completeSale,
  createCustomer,
  searchCustomers,
  searchProducts,
} from '../../services/sales/salesService.js';
import { formatCurrency, timeAgo } from '../../utils/format.js';
import styles from './NewSalePage.module.css';

function cartLineTotal(item) {
  return item.price === '' || !Number.isFinite(Number(item.price)) || Number(item.price) <= 0
    ? null
    : Number(item.qty || 0) * Number(item.price);
}

export default function NewSalePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Customer state
  const [customer, setCustomer] = useState(null); // shared customer row | null until selected
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Product search
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [productSearching, setProductSearching] = useState(false);

  // Cart
  const [cart, setCart] = useState([]);
  const saleAttemptKey = useRef(null);

  // Submit / success
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null); // { sale, cashIn }

  // Customer search debounce
  const customerSearchTimer = useRef(null);
  useEffect(() => {
    if (customerSearchTimer.current) {
      clearTimeout(customerSearchTimer.current);
    }
    setCustomerSearching(true);
    customerSearchTimer.current = setTimeout(async () => {
      try {
        const res = await searchCustomers(customerQuery);
        setCustomerResults(res);
      } catch {
        setCustomerResults([]);
      } finally {
        setCustomerSearching(false);
      }
    }, 220);
    return () => {
      if (customerSearchTimer.current) clearTimeout(customerSearchTimer.current);
    };
  }, [customerQuery]);

  // Product search debounce
  const productSearchTimer = useRef(null);
  useEffect(() => {
    if (productSearchTimer.current) {
      clearTimeout(productSearchTimer.current);
    }
    setProductSearching(true);
    productSearchTimer.current = setTimeout(async () => {
      try {
        const res = await searchProducts(productQuery);
        setProductResults(res);
      } catch {
        setProductResults([]);
      } finally {
        setProductSearching(false);
      }
    }, 200);
    return () => {
      if (productSearchTimer.current) clearTimeout(productSearchTimer.current);
    };
  }, [productQuery]);

  const cartHasPrices = cart.every((line) => cartLineTotal(line) !== null);
  const cartTotal = useMemo(
    () => cart.reduce((sum, line) => sum + (cartLineTotal(line) || 0), 0),
    [cart],
  );

  function pickCustomer(c) {
    setCustomer(c);
    setCustomerQuery('');
    setCustomerResults([]);
  }

  function clearCustomer() {
    setCustomer(null);
  }

  function addToCart(product) {
    setCart((prev) => {
      const found = prev.find((l) => l.productId === product.id);
      if (found) {
        return prev.map((l) =>
          l.productId === product.id
            ? { ...l, qty: Number(l.qty) + 1 }
            : l,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          qty: 1,
          price: '',
          stock: product.stock,
        },
      ];
    });
  }

  function updateCartLine(productId, patch) {
    setCart((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, ...patch } : l)),
    );
  }

  function removeCartLine(productId) {
    setCart((prev) => prev.filter((l) => l.productId !== productId));
  }

  function handleCustomerCreated(created) {
    setCustomer(created);
    setShowCreate(false);
  }

  async function handleComplete() {
    setError('');
    if (cart.length === 0) {
      setError('Add at least one item before completing the sale.');
      return;
    }
    setSubmitting(true);
    try {
      if (!saleAttemptKey.current) {
        saleAttemptKey.current = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      }
      const result = await completeSale(
        { customer, items: cart, idempotencyKey: saleAttemptKey.current },
        { actor: { username: user?.username, role: user?.role } },
      );
      setSuccess(result);
    } catch (err) {
      setError(err?.message || 'Could not complete sale.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleStartAnother() {
    setSuccess(null);
    saleAttemptKey.current = null;
    setCart([]);
    setCustomer(null);
    setCustomerQuery('');
    setCustomerResults([]);
    setProductQuery('');
    searchProducts('').then(setProductResults).catch(() => setProductResults([]));
    setError('');
  }

  function handleViewSale() {
    if (success?.sale?.id) navigate(`/sales/${success.sale.id}`);
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}><T>New sale</T></h1>
          <p className={styles.subtitle}><T>
            Select or create a customer, add products to the
            cart, then review and complete.
          </T></p>
        </div>
      </header>

      <div className={styles.split}>
        {/* ---- Column 1: Customer ---- */}
        <div className={styles.pane}>
          <CustomerPane
            customer={customer}
            customerQuery={customerQuery}
            setCustomerQuery={setCustomerQuery}
            customerResults={customerResults}
            customerSearching={customerSearching}
            onPickCustomer={pickCustomer}
            onClearCustomer={clearCustomer}
            onCreateClick={() => setShowCreate(true)}
          />
        </div>

        {/* ---- Column 2: Products ---- */}
        <div className={styles.pane}>
          <ProductPane
            query={productQuery}
            setQuery={setProductQuery}
            results={productResults}
            searching={productSearching}
            onAdd={addToCart}
            cart={cart}
          />
        </div>

        {/* ---- Column 3: Cart & review ---- */}
        <div className={styles.pane}>
          <CartPane
            cart={cart}
            total={cartTotal}
            onUpdate={updateCartLine}
            onRemove={removeCartLine}
            submitting={submitting}
            error={error}
            canComplete={Boolean(customer) && cart.length > 0 && cartHasPrices && !submitting}
            cartHasPrices={cartHasPrices}
            onComplete={handleComplete}
          />
        </div>
      </div>

      {showCreate ? (
        <QuickCreateCustomerModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCustomerCreated}
        />
      ) : null}

      {success ? (
        <SuccessModal
          result={success}
          onClose={() => setSuccess(null)}
          onAnother={handleStartAnother}
          onView={handleViewSale}
        />
      ) : null}
    </main>
  );
}

/* ========================================================================== */
/* Customer pane                                                                */
/* ========================================================================== */

function CustomerPane({
  customer,
  customerQuery,
  setCustomerQuery,
  customerResults,
  customerSearching,
  onPickCustomer,
  onClearCustomer,
  onCreateClick,
}) {
  return (
    <section className={styles.card} aria-labelledby="new-sale-customer">
      <header className={styles.cardHead}>
        <h2 id="new-sale-customer" className={styles.cardTitle}>
          <span className={styles.cardTitleIcon}>
            <CustomerIcon size={18} strokeWidth={1.75} />
          </span><T>
          Customer
        </T></h2>
        {customer ? (
          <span className={styles.customerChip}>
            {customer.name}
            <button
              type="button"
              className={styles.chipClear}
              onClick={onClearCustomer}
              aria-label="Clear customer"
            ><T>
              &times;
            </T></button>
          </span>
        ) : (
          <span className={styles.walkinChip}><T>Customer required</T></span>
        )}
      </header>

      {!customer ? (
        <>
          <FormField label="Search customer">
            {(controlProps) => (
              <Input
                {...controlProps}
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                placeholder="Name or phone…"
              />
            )}
          </FormField>

          <div className={styles.resultArea} aria-busy={customerSearching}>
            {customerSearching ? (
              <div className={styles.miniLoading}>
                <Spinner size="sm" />
              </div>
            ) : customerResults.length === 0 ? (
              <p className={styles.resultEmpty}><T>No matching customers.</T></p>
            ) : (
              <ul className={styles.resultList}>
                {customerResults.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={styles.resultItem}
                      onClick={() => onPickCustomer(c)}
                    >
                      <span className={styles.resultName}>{c.name}</span>
                      <span className={styles.resultMeta}>
                        {c.phone || 'No phone'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={styles.cardActions}>
            <Button
              variant="secondary"
              size="sm"
              className={styles.newCustomerButton}
              leftIcon={<SparklesIcon size={16} />}
              onClick={onCreateClick}
            ><T>
              New customer
            </T></Button>
          </div>
        </>
      ) : (
        <div className={styles.customerPicked}>
          <div className={styles.pickedHero}>
            <span className={styles.pickedAvatar} aria-hidden="true">
              {(customer.name || '?').trim().charAt(0).toUpperCase()}
            </span>
            <div className={styles.pickedHeroText}>
              <span className={styles.pickedHeroName}>{customer.name}</span>
              <span className={styles.pickedHeroId}><T>ID #</T>{customer.id}</span>
            </div>
          </div>

          <dl className={styles.pickedDetails}>
            <div className={styles.pickedDetail}>
              <dt className={styles.pickedLabel}><T>Phone</T></dt>
              <dd className={styles.pickedValue}>
                {customer.phone || <span className={styles.muted}>—</span>}
              </dd>
            </div>
            <div className={styles.pickedDetail}>
              <dt className={styles.pickedLabel}><T>Address</T></dt>
              <dd className={styles.pickedValue}>
                {customer.address || <span className={styles.muted}>—</span>}
              </dd>
            </div>
            <div className={styles.pickedDetail}>
              <dt className={styles.pickedLabel}><T>Customer ID</T></dt>
              <dd className={styles.pickedValueMuted}>{customer.id}</dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}

/* ========================================================================== */
/* Quick-create customer modal                                                   */
/* ========================================================================== */

function QuickCreateCustomerModal({ onClose, onCreated }) {
  const { user, role } = useAuth();
  const form = useCustomerDraft();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const created = await createCustomer(form.draft, {
        actor: { username: user?.username, role },
      });
      onCreated(created);
    } catch (error_) {
      setErr(error_?.message || 'Could not create customer.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={busy ? undefined : onClose}
      title="New customer"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}><T>
            Cancel
          </T></Button>
          <Button variant="primary" type="submit" form="sale-customer-form"
            loading={busy} loadingText="Creating…"><T>
            Create
          </T></Button>
        </>
      }
    >
      <form id="sale-customer-form" onSubmit={handleSubmit} className={styles.quickCreate} noValidate>
        <CustomerCreateFields form={form} idPrefix="sale-customer" />
        {err ? (
          <p className={styles.modalError} role="alert">
            {err}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}

/* ========================================================================== */
/* Product pane                                                                  */
/* ========================================================================== */

function ProductPane({ query, setQuery, results, searching, onAdd, cart }) {
  const { t } = useLocale();
  const inCartIds = new Set(cart.map((l) => l.productId));

  return (
    <section className={styles.card} aria-labelledby="new-sale-products">
      <header className={styles.cardHead}>
        <h2 id="new-sale-products" className={styles.cardTitle}>
          <span className={styles.cardTitleIcon}>
            <ProductIcon size={18} strokeWidth={1.75} />
          </span><T>
          Products
        </T></h2>
        <span className={styles.cardHint}><T>Tap to add</T></span>
      </header>

      <FormField label="Search product">
        {(controlProps) => (
          <Input
            {...controlProps}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name or product ID…"
          />
        )}
      </FormField>

      <div className={styles.resultArea} aria-busy={searching}>
        {searching ? (
          <div className={styles.miniLoading}>
            <Spinner size="sm" />
          </div>
        ) : results.length === 0 ? (
          <EmptyState
            title="No matching products"
            description="Try a different name or product ID."
          />
        ) : (
          <ul className={styles.productList}>
            {results.map((p) => {
              const inCart = inCartIds.has(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className={styles.productItem}
                    onClick={() => onAdd(p)}
                    aria-label={`${t('Add')} ${p.name} ${t('to cart')}`}
                  >
                    <span className={styles.productName}>{p.name}</span>
                    <span className={styles.productMeta}>
                      <span className={styles.productSku}>{p.id}</span>
                      <span className={styles.productStock}><T>
                        Stock: </T>{p.stock}
                      </span>
                    </span>
                    <span
                      className={[
                        styles.productBadge,
                        inCart ? styles.productBadgeIn : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {t(inCart ? 'In cart' : 'Add')}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ========================================================================== */
/* Cart pane (right column, becomes review on mobile)                            */
/* ========================================================================== */

function CartPane({
  cart,
  total,
  onUpdate,
  onRemove,
  submitting,
  error,
  canComplete,
  cartHasPrices,
  onComplete,
}) {
  const { language, t } = useLocale();
  return (
    <section className={[styles.card, styles.cartCard].join(' ')} aria-label={t('Cart')}>
      <header className={styles.cardHead}>
        <h2 className={styles.cardTitle}>
          <span className={styles.cardTitleIcon}>
            <SaleIcon size={18} strokeWidth={1.75} />
          </span><T>
          Cart & review
        </T></h2>
        <span className={styles.cardHint}>
          {cart.length} {language === 'bn' ? 'লাইন' : cart.length === 1 ? 'line' : 'lines'}
        </span>
      </header>

      <div className={styles.cartBody}>
        {cart.length === 0 ? (
          <div className={styles.cartEmpty}>
            <EmptyState
              icon={<BoxIcon size={28} />}
              title="Cart is empty"
              description="Add products from the left to start the sale."
            />
          </div>
        ) : (
          <ul className={styles.cartList}>
            {cart.map((line) => {
              const lineTotal = cartLineTotal(line);
              return (
                <li key={line.productId} className={styles.cartItem}>
                  <div className={styles.cartItemHead}>
                    <span className={styles.cartItemName}>
                      {line.productName}
                    </span>
                    <button
                      type="button"
                      className={styles.cartItemRemove}
                      onClick={() => onRemove(line.productId)}
                      aria-label={`${t('Remove')} ${line.productName}`}
                    ><T>
                      &times;
                    </T></button>
                  </div>
                  <div className={styles.cartItemGrid}>
                    <label className={styles.cartItemField}>
                      <span className={styles.cartItemFieldLabel}><T>Qty</T></span>
                      <Input
                        type="number"
                        size="sm"
                        min={1}
                        step={1}
                        value={line.qty}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          onUpdate(line.productId, {
                            qty: Number.isFinite(next) && next >= 1 ? next : 1,
                          });
                        }}
                      />
                    </label>
                    <label className={styles.cartItemField}>
                      <span className={styles.cartItemFieldLabel}><T>Price</T></span>
                      <Input
                        type="number"
                        size="sm"
                        min={0.01}
                        step="0.01"
                        value={line.price}
                        onChange={(e) => {
                          onUpdate(line.productId, { price: e.target.value });
                        }}
                      />
                    </label>
                    <div className={styles.cartItemTotal}>
                      <span className={styles.cartItemFieldLabel}><T>Total</T></span>
                      <span className={styles.cartItemTotalValue}>
                          {lineTotal === null ? '—' : formatCurrency(lineTotal)}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className={styles.cartFooter}>
        <div className={styles.totalRow}>
          <span className={styles.totalLabel}><T>Total</T></span>
          <span className={styles.totalValue}>{cartHasPrices ? formatCurrency(total) : '—'}</span>
        </div>
        {!cartHasPrices ? <p className={styles.priceHint}><T>Enter a selling price for each item.</T></p> : null}
        {error ? (
          <p className={styles.cartError} role="alert">
            <T>{error}</T>
          </p>
        ) : null}
        <Button
          variant="primary"
          fullWidth
          size="lg"
          className={styles.completeButton}
          leftIcon={<SparklesIcon size={16} />}
          onClick={onComplete}
          disabled={!canComplete}
          loading={submitting}
          loadingText="Completing…"
        ><T>
          Complete sale
        </T></Button>
      </div>
    </section>
  );
}

/* ========================================================================== */
/* Success modal — surfaces the generated sales_code                            */
/* ========================================================================== */

function SuccessModal({ result, onClose, onAnother, onView }) {
  const { sale, cashIn } = result;
  return (
    <Modal
      open
      onClose={onClose}
      title="Sale completed"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onAnother}><T>
            Start another
          </T></Button>
          <Button variant="secondary" onClick={onView}><T>
            View sale
          </T></Button>
          <Button variant="primary" onClick={onClose}><T>
            Done
          </T></Button>
        </>
      }
    >
      <div className={styles.successWrap}>
        <div className={styles.successBadge}>
          <SparklesIcon size={28} strokeWidth={1.75} />
        </div>
        <h3 className={styles.successTitle}>{sale.salesCode}</h3>
        <p className={styles.successSubtitle}><T>
          Recorded </T>{timeAgo(sale.createdAt)}
          {cashIn ? <><T> &middot; cash-in </T><code>{cashIn.id}</code></> : null}
        </p>

        <dl className={styles.successSummary}>
          <div className={styles.successRow}>
            <dt><T>Customer</T></dt>
            <dd>{sale.customerName}</dd>
          </div>
          <div className={styles.successRow}>
            <dt><T>Items</T></dt>
            <dd>{sale.items.length}</dd>
          </div>
          <div className={styles.successRow}>
            <dt><T>Total</T></dt>
            <dd className={styles.successTotal}>{formatCurrency(sale.total)}</dd>
          </div>
        </dl>
      </div>
    </Modal>
  );
}
