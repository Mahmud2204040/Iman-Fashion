import styles from './DataTable.module.css';
import Spinner from '../Spinner/Spinner.jsx';
import EmptyState from '../EmptyState/EmptyState.jsx';

/**
 * Generic DataTable.
 *
 * Desktop / tablet: renders a real <table>.
 * Mobile (< 640px): if `mobileRenderer` is provided, uses it for each row;
 * otherwise falls back to stacked key/value cards derived from columns.
 *
 * Props:
 *   columns: [{ key, header, render?, align?, width?, mobileHidden? }]
 *   data: array of objects
 *   rowKey: string | (row) => string   — defaults to 'id'
 *   loading, emptyTitle, emptyDescription, emptyAction,
 *   mobileRenderer: (row, columns) => ReactNode   — optional custom mobile card
 */
function DataTable({
  columns = [],
  data = [],
  rowKey = 'id',
  loading = false,
  emptyTitle = 'No data',
  emptyDescription,
  emptyAction = null,
  mobileRenderer = null,
  className = '',
  ...rest
}) {
  const getKey = (row, index) => {
    if (typeof rowKey === 'function') return rowKey(row) || index;
    return row[rowKey] ?? index;
  };

  const renderCell = (col, row) => {
    if (typeof col.render === 'function') return col.render(row);
    const v = row[col.key];
    if (v === null || v === undefined || v === '') return '—';
    return String(v);
  };

  if (loading) {
    return (
      <div className={[styles.wrap, className].filter(Boolean).join(' ')}>
        <div className={styles.loading}>
          <Spinner size="md" />
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={[styles.wrap, className].filter(Boolean).join(' ')}>
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </div>
    );
  }

  return (
    <div className={[styles.wrap, className].filter(Boolean).join(' ')} {...rest}>
      {/* Desktop / tablet */}
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={styles.th}
                  style={{
                    textAlign: col.align || 'left',
                    width: col.width,
                  }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={getKey(row, i)} className={styles.tr}>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={styles.td}
                    style={{ textAlign: col.align || 'left' }}
                  >
                    {renderCell(col, row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className={styles.cardList}>
        {data.map((row, i) => {
          const key = getKey(row, i);
          return (
            <li key={key} className={styles.card}>
              {mobileRenderer ? (
                mobileRenderer(row, columns)
              ) : (
                <dl className={styles.cardList_inner}>
                  {columns
                    .filter((c) => !c.mobileHidden)
                    .map((c) => (
                      <div key={c.key} className={styles.cardRow}>
                        <dt className={styles.cardLabel}>{c.header}</dt>
                        <dd className={styles.cardValue}>{renderCell(c, row)}</dd>
                      </div>
                    ))}
                </dl>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default DataTable;