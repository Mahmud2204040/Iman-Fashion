import { Button, FormField, Input, Textarea } from '../common/index.js';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { formatExactDate } from '../../utils/format.js';
import calendarIcon from '../../assets/figma/new-customer/calendar-days.svg';
import plusIcon from '../../assets/figma/new-customer/plus.svg';
import trashIcon from '../../assets/figma/new-customer/trash-2.svg';
import styles from './CustomerCreateFields.module.css';

export default function CustomerCreateFields({ form, idPrefix = 'customer', variant = 'default' }) {
  const { draft, setField, addChild, removeChild, setChildField } = form;
  const { t } = useLocale();

  if (variant === 'new-customer') {
    return (
      <div className={styles.figmaFields}>
        <section className={styles.figmaSection} aria-label={t('Customer details')}>
          <div className={styles.figmaSectionHead}>
            <h2>{t('Customer details')}</h2>
            <span>{t('* Required fields')}</span>
          </div>
          <div className={styles.figmaGrid}>
            <FormField label="Customer name" htmlFor={`${idPrefix}-name`} required>
              {(controlProps) => <Input {...controlProps} id={`${idPrefix}-name`} value={draft.name} onChange={(event) => setField('name', event.target.value)} placeholder="Enter full name" required minLength={2} />}
            </FormField>
            <FormField label="Phone" htmlFor={`${idPrefix}-phone`} required>
              {(controlProps) => <Input {...controlProps} id={`${idPrefix}-phone`} type="tel" inputMode="tel" value={draft.phone} onChange={(event) => setField('phone', event.target.value)} placeholder="01XXXXXXXXX" required />}
            </FormField>
          </div>
          <FormField label={<>{t('Address')} <span className={styles.figmaOptional}>{t('(optional)')}</span></>} htmlFor={`${idPrefix}-address`}>
            {(controlProps) => <Input {...controlProps} id={`${idPrefix}-address`} value={draft.address} onChange={(event) => setField('address', event.target.value)} placeholder="Enter customer address" />}
          </FormField>
          <FormField label={<>{t('Guardian notes')} <span className={styles.figmaOptional}>{t('(optional)')}</span></>} htmlFor={`${idPrefix}-notes`}>
            {(controlProps) => <Textarea {...controlProps} id={`${idPrefix}-notes`} rows={3} value={draft.notes} onChange={(event) => setField('notes', event.target.value)} placeholder="Add any notes about the guardian" />}
          </FormField>
        </section>

        <section className={styles.figmaSection} aria-label={t('Children')}>
          <div className={styles.figmaChildrenHead}>
            <h2>{t('Children')}</h2>
            <span>{t('(optional)')}</span>
            <strong>{draft.children.length} {t(draft.children.length === 1 ? 'child' : 'children')}</strong>
          </div>
          {draft.children.map((child, index) => (
            <div className={styles.figmaChild} key={index}>
              <div className={styles.figmaChildHead}>
                <strong>{t('Child')} #{index + 1}</strong>
                <button type="button" onClick={() => removeChild(index)} aria-label={`${t('Remove child')} ${index + 1}`}>
                  <img src={trashIcon} alt="" width="16" height="16" />{t('Remove')}
                </button>
              </div>
              <div className={styles.figmaGrid}>
                <label className={styles.figmaLabel}><span className={styles.figmaLabelText}>{t('Name')} <em>*</em></span>
                  <input value={child.name} required minLength={2} placeholder={t('Enter child’s name')} onChange={(event) => setChildField(index, 'name', event.target.value)} />
                </label>
                <label className={styles.figmaLabel}><span className={styles.figmaLabelText}>{t('Initial class')} <em>*</em></span>
                  <input value={child.initialClass} required placeholder={t('Enter initial class')} onChange={(event) => setChildField(index, 'initialClass', event.target.value)} />
                </label>
                <label className={styles.figmaLabel}><span className={styles.figmaLabelText}>{t('School')} <em>*</em></span>
                  <input value={child.schoolName} required placeholder={t('Enter school name')} onChange={(event) => setChildField(index, 'schoolName', event.target.value)} />
                </label>
                <label className={styles.figmaLabel}><span className={styles.figmaLabelText}>{t('Registered date')} <em>*</em></span>
                  <span className={styles.figmaDate}>
                    <span className={styles.figmaDateText}>{child.registeredDate ? formatExactDate(`${child.registeredDate}T12:00:00+06:00`) : t('Select date')}</span>
                    <input className={styles.figmaDateNative} type="date" value={child.registeredDate} required onChange={(event) => setChildField(index, 'registeredDate', event.target.value)} />
                    <img src={calendarIcon} alt="" width="16" height="16" />
                  </span>
                </label>
              </div>
            </div>
          ))}
          <button type="button" className={styles.figmaAddChild} onClick={addChild}>
            <img src={plusIcon} alt="" width="16" height="16" />{t('Add child')}
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.fields}>
      <section className={styles.section} aria-label={t('Customer details')}>
        <h3 className={styles.heading}>{t('Customer details')}</h3>
        <FormField label="Name" htmlFor={`${idPrefix}-name`} required>
          {(controlProps) => (
            <Input {...controlProps} id={`${idPrefix}-name`} value={draft.name}
              onChange={(event) => setField('name', event.target.value)}
              placeholder="e.g. Anika Tabassum" required minLength={2} />
          )}
        </FormField>
        <div className={styles.grid}>
          <FormField label="Phone" htmlFor={`${idPrefix}-phone`} required>
            {(controlProps) => (
              <Input {...controlProps} id={`${idPrefix}-phone`} type="tel" inputMode="tel"
                value={draft.phone} onChange={(event) => setField('phone', event.target.value)}
                placeholder="01XXXXXXXXX" required />
            )}
          </FormField>
          <FormField label="Address" htmlFor={`${idPrefix}-address`}>
            {(controlProps) => (
              <Input {...controlProps} id={`${idPrefix}-address`} value={draft.address}
                onChange={(event) => setField('address', event.target.value)}
                placeholder="Customer address (optional)" />
            )}
          </FormField>
        </div>
        <FormField label="Guardian notes" htmlFor={`${idPrefix}-notes`}
          hint="Optional. Notes belong to the customer/guardian, not a child.">
          {(controlProps) => (
            <Textarea {...controlProps} id={`${idPrefix}-notes`} rows={3} value={draft.notes}
              onChange={(event) => setField('notes', event.target.value)} />
          )}
        </FormField>
      </section>

      <section className={styles.section} aria-label={t('Children')}>
        <h3 className={styles.heading}>{t('Children (optional)')}</h3>
        {draft.children.map((child, index) => (
          <div className={styles.child} key={index}>
            <div className={styles.childHeader}>
              <strong>{t('Child')} #{index + 1}</strong>
              <button type="button" className={styles.remove}
                onClick={() => removeChild(index)} aria-label={`${t('Remove child')} ${index + 1}`}>
                {t('Remove')}
              </button>
            </div>
            <div className={styles.grid}>
              <label className={styles.label}>{t('Name')} *
                <input className={styles.input} value={child.name} required minLength={2}
                  onChange={(event) => setChildField(index, 'name', event.target.value)} />
              </label>
              <label className={styles.label}>{t('Initial class')} *
                <input className={styles.input} value={child.initialClass} required
                  onChange={(event) => setChildField(index, 'initialClass', event.target.value)} />
              </label>
              <label className={styles.label}>{t('School')} *
                <input className={styles.input} value={child.schoolName} required
                  onChange={(event) => setChildField(index, 'schoolName', event.target.value)} />
              </label>
              <label className={styles.label}>{t('Registered date')} *
                <input className={styles.input} type="date" value={child.registeredDate} required
                  onChange={(event) => setChildField(index, 'registeredDate', event.target.value)} />
              </label>
            </div>
          </div>
        ))}
        <Button type="button" variant="secondary" onClick={addChild}>+ Add child</Button>
      </section>
    </div>
  );
}
