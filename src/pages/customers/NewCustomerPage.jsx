/** Figma 18:298 customer creation screen; shares customer rules with quick-create. */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import T from '../../components/common/LocalizedText.jsx';
import { Button } from '../../components/common/index.js';
import CustomerCreateFields from '../../components/customers/CustomerCreateFields.jsx';
import { useCustomerDraft } from '../../components/customers/useCustomerDraft.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { createCustomer } from '../../services/customers/customerService.js';
import { formatExactDate } from '../../utils/format.js';
import arrowLeftIcon from '../../assets/figma/new-customer/arrow-left.svg';
import contactIcon from '../../assets/figma/new-customer/contact-round.svg';
import indicatorIcon from '../../assets/figma/new-customer/indicator.svg';
import userIcon from '../../assets/figma/new-customer/user-round.svg';
import phoneIcon from '../../assets/figma/new-customer/phone.svg';
import statusIndicatorIcon from '../../assets/figma/new-customer/status-indicator.svg';
import calendarSmallIcon from '../../assets/figma/new-customer/calendar-days-small.svg';
import infoIcon from '../../assets/figma/new-customer/info.svg';
import styles from './NewCustomerPage.module.css';

export default function NewCustomerPage() {
  const { role, user } = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();
  const form = useCustomerDraft();
  const { name, phone, address, notes, children } = form.draft;
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      const created = await createCustomer(form.draft, {
        actor: { username: user?.username, role },
      });
      navigate(`/customers/${created.id}`);
    } catch (error) {
      setSubmitError(error?.message || 'Could not create customer.');
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.pageContext}>
        <Link to="/customers" className={styles.backLink}>
          <img src={arrowLeftIcon} alt="" width="16" height="16" />
          <T>All customers</T>
        </Link>
        <div className={styles.headingRow}>
          <div>
            <h1><T>New customer</T></h1>
            <p><T>Create a customer record with contact details and children.</T></p>
          </div>
          <Link to="/customers" className={styles.directoryLink}>
            <img src={contactIcon} alt="" width="16" height="16" />
            <T>Customer Directory</T>
          </Link>
        </div>
      </div>

      <div className={styles.workspace}>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <CustomerCreateFields form={form} idPrefix="new-customer" variant="new-customer" />
          {submitError ? <p className={styles.errorBanner} role="alert"><T>{submitError}</T></p> : null}
          <div className={styles.formFooter}>
            <span><T>Customer record</T> · {children.length} {t(children.length === 1 ? 'child' : 'children')}</span>
            <div className={styles.actions}>
              <Link to="/customers" className={styles.cancelButton}><T>Cancel</T></Link>
              <Button type="submit" variant="primary" className={styles.createButton} disabled={submitting}>
                {submitting ? t('Creating…') : t('Create customer')}
              </Button>
            </div>
          </div>
        </form>

        <aside className={styles.preview} aria-label={t('Record preview')}>
          <div className={styles.previewHeading}>
            <span><T>Record preview</T></span>
            <span className={styles.liveIndicator}>
              <img src={indicatorIcon} alt="" width="5" height="5" />
              <T>Updates as you type</T>
            </span>
          </div>
          <div className={styles.previewCard}>
            <div className={styles.identity}>
              <div className={styles.avatar} aria-hidden="true">
                <img src={userIcon} alt="" width="22" height="22" />
              </div>
              <strong className={name.trim() ? '' : styles.placeholder}>{name.trim() || t('Customer name')}</strong>
              <div className={styles.phoneLine}>
                <img src={phoneIcon} alt="" width="14" height="14" />
                <span>{phone.trim() || `${t('Phone on file')} · ${t('Not entered')}`}</span>
              </div>
            </div>
            <dl className={styles.contactDetails}>
              <div>
                <dt><T>Address</T></dt>
                <dd className={address.trim() ? '' : styles.placeholder}>{address.trim() || t('Not entered')}</dd>
              </div>
              <div>
                <dt><T>Guardian notes</T></dt>
                <dd className={notes.trim() ? '' : styles.placeholder}>{notes.trim() || t('Not entered')}</dd>
              </div>
            </dl>
            <dl className={styles.previewFacts}>
              <div><dt><T>Status</T></dt><dd className={styles.activeBadge}><img src={statusIndicatorIcon} alt="" width="5" height="5" /><T>Active</T></dd></div>
              <div><dt><T>Children</T></dt><dd>{children.length} {t(children.length === 1 ? 'child' : 'children')}</dd></div>
              <div><dt><T>Customer code</T></dt><dd><T>Assigned on save</T></dd></div>
            </dl>
            {children.map((child, index) => (
              <div key={index} className={styles.childPreview}>
                <strong>{t('Child')} #{index + 1}</strong>
                <span className={child.name.trim() ? '' : styles.placeholder}>{child.name.trim() || t('Child name')}</span>
                <small>{child.initialClass.trim() || t('Class not entered')}</small>
                <small>{child.schoolName.trim() || t('School not entered')}</small>
                <small className={styles.registeredDate}>
                  <img src={calendarSmallIcon} alt="" width="14" height="14" />
                  {t('Registered')} {formatExactDate(`${child.registeredDate}T12:00:00+06:00`)}
                </small>
              </div>
            ))}
          </div>
          <p className={styles.saveGuidance}>
            <img src={infoIcon} alt="" width="16" height="16" />
            <T>The customer code is assigned when you save. This record hasn’t been created yet.</T>
          </p>
        </aside>
      </div>
    </main>
  );
}
