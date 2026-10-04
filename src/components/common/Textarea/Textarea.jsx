import { forwardRef } from 'react';
import { useLocale } from '../../../contexts/LocaleContext.jsx';
import styles from './Textarea.module.css';

const Textarea = forwardRef(function Textarea(
  {
    value,
    onChange,
    placeholder,
    disabled = false,
    readOnly = false,
    required = false,
    invalid = false,
    rows = 4,
    fullWidth = true,
    name,
    id,
    className = '',
    'aria-label': ariaLabel,
    ...rest
  },
  ref,
) {
  const { t } = useLocale();
  const classes = [
    styles.textarea,
    fullWidth ? styles.fullWidth : '',
    invalid ? styles.invalid : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <textarea
      ref={ref}
      id={id}
      name={name}
      value={value ?? ''}
      onChange={onChange}
      placeholder={typeof placeholder === 'string' ? t(placeholder) : placeholder}
      disabled={disabled}
      readOnly={readOnly}
      required={required}
      rows={rows}
      aria-invalid={invalid || undefined}
      aria-label={typeof ariaLabel === 'string' ? t(ariaLabel) : ariaLabel}
      className={classes}
      {...rest}
    />
  );
});

export default Textarea;
