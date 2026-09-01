/**
 * NewSalePage — Phase 5.
 *
 * Two-pane layout on desktop, stacked on mobile.
 *
 * Flow:
 *   1. Customer search (or quick-create, or skip as walk-in).
 *   2. Product search → pick qty + price → add to cart.
 *      Same product re-added merges qty.
 *   3. Review cart (itemised table + total).
 *   4. Complete → success modal with the generated sales_code.
 *
 * Per FRONTEND_PLAN.md Phase 5:
 *   - Price validation: numeric and present; zero NOT blocked.
 *   - Sale creates a CASH_IN row with reference_type: SALE (handled
 *     inside salesService.completeSale).
 *   - sales_code format S-YYYYMMDD-NNNN generated on complete.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth.js';
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
  return Number(item.qty || 0) * Number(item.price || 0);
}

export default function NewSalePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Customer state
  const [customer, setCustomer] = useState(null); // { id, name } | null (walk-in)
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

  const cartTotal = useMemo(
    () => cart.reduce((sum, line) => sum + cartLineTotal(line), 0),
    [cart],
  );

  const cartCount = useMemo(
    () => cart.reduce((sum, line) => sum + Number(line.qty || 0), 0),
    [cart],
  );

  function pickCustomer(c) {
    setCustomer({ id: c.id, name: c.name });
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
          sku: product.sku,
          qty: 1,
          price: Number(product.price || 0),
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
    setCustomer({ id: created.id, name: created.name });
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
      const result = await completeSale(
        { customer, items: cart },
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
    setCart([]);
    setCustomer(null);
    setCustomerQuery('');
    setCustomerResults([]);
    setProductQuery('');
    setProductResults([]);
    setError('');
  }

  function handleViewSale() {
    if (success?.sale?.id) navigate(`/sales/${success.sale.id}`);
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <span className={styles.eyebrow}>Sales</span>
          <h1 className={styles.title}>New sale</h1>
          <p className={styles.subtitle}>
            Search for a customer (or skip for walk-in), add products to the
            cart, then review and complete.
          </p>
        </div>
        <div className={styles.headerStats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Items in cart</span>
            <span className={styles.statValue}>{cartCount}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Estimated total</span>
            <span className={styles.statValue}>
              {formatCurrency(cartTotal)}
            </span>
          </div>
        </div>
      </header>

      <div className={styles.split}>
        {/* ---- Left pane: Customer + Products ---- */}
        <div className={styles.left}>
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

          <ProductPane
            query={productQuery}
            setQuery={setProductQuery}
            results={productResults}
            searching={productSearching}
            onAdd={addToCart}
            cart={cart}
          />
        </div>

        {/* ---- Right pane: Cart / Review ---- */}
        <div className={styles.right}>
          <CartPane
            cart={cart}
            total={cartTotal}
            onUpdate={updateCartLine}
            onRemove={removeCartLine}
            submitting={submitting}
            error={error}
            canComplete={cart.length > 0 && !submitting}
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
          <CustomerIcon size={18} strokeWidth={1.75} /> Customer
        </h2>
        {customer ? (
          <span className={styles.customerChip}>
            {customer.name}
            <button
              type="button"
              className={styles.chipClear}
              onClick={onClearCustomer}
              aria-label="Clear customer"
            >
              &times;
            </button>
          </span>
        ) : (
          <span className={styles.walkinChip}>Walk-in customer</span>
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
              <p className={styles.resultEmpty}>No matching customers.</p>
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
              leftIcon={<SparklesIcon size={16} />}
              onClick={onCreateClick}
            >
              New customer
            </Button>
          </div>
        </>
      ) : (
        <div className={styles.customerPicked}>
          <div className={styles.pickedRow}>
            <span className={styles.pickedLabel}>Name</span>
            <span className={styles.pickedValue}>{customer.name}</span>
          </div>
          <div className={styles.pickedRow}>
            <span className={styles.pickedLabel}>Customer ID</span>
            <span className={styles.pickedValueMuted}>{customer.id}</span>
          </div>
        </div>
      )}
    </section>
  );
}

/* ========================================================================== */
/* Quick-create customer modal                                                   */
/* ========================================================================== */

function QuickCreateCustomerModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const created = await createCustomer({ name, phone });
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
      title="Quick-create customer"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={busy}
            loadingText="Creating…"
          >
            Create
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className={styles.quickCreate}>
        <FormField label="Name" required>
          {(controlProps) => (
            <Input
              {...controlProps}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Anika Tabassum"
              autoFocus
              required
            />
          )}
        </FormField>
        <FormField label="Phone (optional)">
          {(controlProps) => (
            <Input
              {...controlProps}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01XXXXXXXXX"
            />
          )}
        </FormField>
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
  const inCartIds = new Set(cart.map((l) => l.productId));

  return (
    <section className={styles.card} aria-labelledby="new-sale-products">
      <header className={styles.cardHead}>
        <h2 id="new-sale-products" className={styles.cardTitle}>
          <ProductIcon size={18} strokeWidth={1.75} /> Products
        </h2>
        <span className={styles.cardHint}>Tap to add</span>
      </header>

      <FormField label="Search product">
        {(controlProps) => (
          <Input
            {...controlProps}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name or SKU…"
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
            description="Try a different name or SKU."
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
                    aria-label={`Add ${p.name} to cart`}
                  >
                    <span className={styles.productName}>{p.name}</span>
                    <span className={styles.productMeta}>
                      <span className={styles.productSku}>{p.sku}</span>
                      <span className={styles.productPrice}>
                        {formatCurrency(p.price)}
                      </span>
                      <span className={styles.productStock}>
                        Stock: {p.stock}
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
                      {inCart ? 'In cart' : 'Add'}
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
  onComplete,
}) {
  return (
    <section className={[styles.card, styles.cartCard].join(' ')} aria-label="Cart">
      <header className={styles.cardHead}>
        <h2 className={styles.cardTitle}>
          <SaleIcon size={18} strokeWidth={1.75} /> Cart & review
        </h2>
        <span className={styles.cardHint}>
          {cart.length} line{cart.length === 1 ? '' : 's'}
        </span>
      </header>

      {cart.length === 0 ? (
        <EmptyState
          icon={<BoxIcon size={28} />}
          title="Cart is empty"
          description="Add products from the left to start the sale."
        />
      ) : (
        <>
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
                      aria-label={`Remove ${line.productName}`}
                    >
                      &times;
                    </button>
                  </div>
                  <div className={styles.cartItemGrid}>
                    <label className={styles.cartItemField}>
                      <span className={styles.cartItemFieldLabel}>Qty</span>
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
                      <span className={styles.cartItemFieldLabel}>Price</span>
                      <Input
                        type="number"
                        size="sm"
                        min={0}
                        step="0.01"
                        value={line.price}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          onUpdate(line.productId, {
                            price: Number.isFinite(next) && next >= 0 ? next : 0,
                          });
                        }}
                      />
                    </label>
                    <div className={styles.cartItemTotal}>
                      <span className={styles.cartItemFieldLabel}>Line</span>
                      <span className={styles.cartItemTotalValue}>
                        {formatCurrency(lineTotal)}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className={styles.cartFooter}>
            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>Total</span>
              <span className={styles.totalValue}>{formatCurrency(total)}</span>
            </div>
            {error ? (
              <p className={styles.cartError} role="alert">
                {error}
              </p>
            ) : null}
            <Button
              variant="primary"
              fullWidth
              size="lg"
              leftIcon={<SparklesIcon size={16} />}
              onClick={onComplete}
              disabled={!canComplete}
              loading={submitting}
              loadingText="Completing…"
            >
              Complete sale
            </Button>
          </div>
        </>
      )}
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
          <Button variant="ghost" onClick={onAnother}>
            Start another
          </Button>
          <Button variant="secondary" onClick={onView}>
            View sale
          </Button>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <div className={styles.successWrap}>
        <div className={styles.successBadge}>
          <SparklesIcon size={28} strokeWidth={1.75} />
        </div>
        <h3 className={styles.successTitle}>{sale.salesCode}</h3>
        <p className={styles.successSubtitle}>
          Recorded {timeAgo(sale.createdAt)} &middot; cash-in{' '}
          <code>{cashIn.id}</code>
        </p>

        <dl className={styles.successSummary}>
          <div className={styles.successRow}>
            <dt>Customer</dt>
            <dd>{sale.customerName}</dd>
          </div>
          <div className={styles.successRow}>
            <dt>Items</dt>
            <dd>{sale.items.length}</dd>
          </div>
          <div className={styles.successRow}>
            <dt>Total</dt>
            <dd className={styles.successTotal}>{formatCurrency(sale.total)}</dd>
          </div>
        </dl>
      </div>
    </Modal>
  );
}
