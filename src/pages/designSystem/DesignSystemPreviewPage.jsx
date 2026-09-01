import { useState } from 'react';
import {
  Button,
  Input,
  Select,
  Textarea,
  FormField,
  Badge,
  Spinner,
  EmptyState,
  Modal,
  ConfirmDialog,
  DataTable,
} from '../../components/common/index.js';
import styles from './DesignSystemPreviewPage.module.css';

/**
 * Design-System Preview — DEVELOPMENT ONLY.
 *
 * This page exists solely to verify that the design system renders
 * correctly across breakpoints. It does NOT contain business logic,
 * navigation, or real data sources.
 */
function Section({ title, children }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

function DesignSystemPreviewPage() {
  const [inputValue, setInputValue] = useState('');
  const [selectValue, setSelectValue] = useState('');
  const [textareaValue, setTextareaValue] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loadingBtn, setLoadingBtn] = useState(false);
  const [loadingConfirm, setLoadingConfirm] = useState(false);

  const tableColumns = [
    { key: 'id', header: 'ID', width: 80 },
    { key: 'name', header: 'Name' },
    { key: 'status', header: 'Status', render: (row) => <Badge variant={row.statusVariant}>{row.status}</Badge> },
    { key: 'amount', header: 'Amount', align: 'right', mobileHidden: false },
    { key: 'date', header: 'Date' },
  ];

  const tableData = [
    { id: 1, name: 'Shirt', status: 'Active', statusVariant: 'success', amount: '৳450', date: '2026-09-01' },
    { id: 2, name: 'Pant', status: 'Pending', statusVariant: 'warning', amount: '৳600', date: '2026-09-01' },
    { id: 3, name: 'Salwar', status: 'Inactive', statusVariant: 'neutral', amount: '৳350', date: '2026-08-31' },
  ];

  const handleLoadingClick = () => {
    setLoadingBtn(true);
    setTimeout(() => setLoadingBtn(false), 1200);
  };

  const handleConfirm = () => {
    setLoadingConfirm(true);
    setTimeout(() => {
      setLoadingConfirm(false);
      setConfirmOpen(false);
    }, 1000);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.devBadge}>Development Only</span>
        <h1 className={styles.title}>Design System Preview</h1>
        <p className={styles.subtitle}>
          Sanity-check for tokens and common components. Not a real application page.
        </p>
      </header>

      <Section title="Buttons">
        <div className={styles.row}>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="ghost">Ghost</Button>
        </div>
        <div className={styles.row}>
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
        <div className={styles.row}>
          <Button disabled>Disabled</Button>
          <Button loading={loadingBtn} loadingText="Saving…" onClick={handleLoadingClick}>
            Click to load
          </Button>
          <Button fullWidth>Full-width</Button>
        </div>
      </Section>

      <Section title="Inputs">
        <div className={styles.formGrid}>
          <FormField label="Name" required helper="Helper text here">
            {(controlProps) => (
              <Input
                {...controlProps}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Enter name"
              />
            )}
          </FormField>

          <FormField label="Category">
            {(controlProps) => (
              <Select
                {...controlProps}
                placeholder="Select category"
                value={selectValue}
                onChange={(e) => setSelectValue(e.target.value)}
                options={[
                  { value: 'shirt', label: 'Shirt' },
                  { value: 'pant', label: 'Pant' },
                  { value: 'frock', label: 'Frock' },
                ]}
              />
            )}
          </FormField>

          <FormField label="Notes" error="Notes cannot be empty">
            {(controlProps) => (
              <Textarea
                {...controlProps}
                rows={3}
                value={textareaValue}
                onChange={(e) => setTextareaValue(e.target.value)}
                placeholder="Write something"
              />
            )}
          </FormField>

          <FormField label="Disabled">
            {(controlProps) => (
              <Input {...controlProps} disabled placeholder="Disabled" />
            )}
          </FormField>
        </div>
      </Section>

      <Section title="Badges">
        <div className={styles.row}>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="danger">Danger</Badge>
          <Badge variant="info">Info</Badge>
          <Badge variant="neutral">Neutral</Badge>
        </div>
        <div className={styles.row}>
          <Badge variant="success" size="sm">Paid</Badge>
          <Badge variant="warning" size="sm">Pending</Badge>
          <Badge variant="info" size="sm">Ready</Badge>
          <Badge variant="success" size="sm">Delivered</Badge>
          <Badge variant="danger" size="sm">Cancelled</Badge>
          <Badge variant="neutral" size="sm">Active</Badge>
          <Badge variant="neutral" size="sm">Inactive</Badge>
        </div>
      </Section>

      <Section title="Spinner">
        <div className={styles.row}>
          <Spinner size="sm" />
          <Spinner size="md" />
          <Spinner size="lg" />
          <Spinner size={48} />
        </div>
      </Section>

      <Section title="Empty State">
        <EmptyState
          title="No customers found"
          description="There are no customers matching your search."
          action={<Button variant="primary">Add Customer</Button>}
        />
      </Section>

      <Section title="Modal & Confirm Dialog">
        <div className={styles.row}>
          <Button variant="secondary" onClick={() => setModalOpen(true)}>
            Open modal
          </Button>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Open confirm
          </Button>
        </div>

        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Modal title"
          footer={
            <>
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => setModalOpen(false)}>
                Save
              </Button>
            </>
          }
        >
          <p>Modal body content. Press Escape or click the overlay to close.</p>
        </Modal>

        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={handleConfirm}
          title="Deactivate customer?"
          message="This customer will become inactive but will not be deleted."
          confirmText="Deactivate"
          tone="danger"
          loading={loadingConfirm}
        />
      </Section>

      <Section title="DataTable">
        <DataTable
          columns={tableColumns}
          data={tableData}
          rowKey="id"
          emptyTitle="No rows"
          emptyDescription="Nothing to display yet."
        />
      </Section>

      <Section title="DataTable — empty & loading">
        <div className={styles.col}>
          <DataTable columns={tableColumns} data={[]} emptyTitle="No data yet" />
          <DataTable columns={tableColumns} data={[]} loading />
        </div>
      </Section>
    </div>
  );
}

export default DesignSystemPreviewPage;