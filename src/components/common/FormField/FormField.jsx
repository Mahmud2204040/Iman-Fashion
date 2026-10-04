import { cloneElement, isValidElement, useId } from 'react';
import { useLocale } from '../../../contexts/LocaleContext.jsx';
import styles from './FormField.module.css';

/**
 * FormField provides a consistent structure:
 *
 *   <Label (with required indicator)>
 *   <Control>
 *   <Helper | Error>
 *
 * The child control receives `id`, `error`, and `aria-describedby` via a
 * render-prop or clone. The simpler API in this phase is: pass the control
 * as children and use `controlProps` to spread the wiring onto it.
 *
 * This component does NOT implement business validation.
 */
function FormField({
  label,
  htmlFor,
  required = false,
  error,
  helper,
  className = '',
  children,
}) {
  const { t } = useLocale();
  const generatedId = useId();
  const fieldId = htmlFor || generatedId;
  const helperId = helper ? `${fieldId}-helper` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [helperId, errorId].filter(Boolean).join(' ') || undefined;

  const classes = [styles.field, error ? styles.invalid : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      {label ? (
        <label className={styles.label} htmlFor={fieldId}>
          {typeof label === 'string' ? t(label) : label}
          {required ? (
            <span className={styles.required} aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}

      <div className={styles.control}>
        {typeof children === 'function'
          ? children({ id: fieldId, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })
          : isValidElement(children)
            ? cloneElement(children, {
                id: children.props.id || fieldId,
                'aria-describedby': describedBy,
                'aria-invalid': error ? true : undefined,
              })
            : children}
      </div>

      {helper && !error ? (
        <p id={helperId} className={styles.helper}>
          {typeof helper === 'string' ? t(helper) : helper}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} className={styles.error} role="alert">
          {typeof error === 'string' ? t(error) : error}
        </p>
      ) : null}
    </div>
  );
}

export default FormField;
