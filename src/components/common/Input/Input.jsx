import { forwardRef } from 'react';
import { useLocale } from '../../../contexts/LocaleContext.jsx';
import styles from './Input.module.css';

/**
 * Generic Input. No business validation. Pair with FormField for labels.
 */
const Input = forwardRef(function Input(
  {
    type = 'text',
    value,
    onChange,
    placeholder,
    disabled = false,
    readOnly = false,
    required = false,
    invalid = false,
    fullWidth = true,
    size = 'md',
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
    styles.input,
    styles[`size-${size}`],
    fullWidth ? styles.fullWidth : '',
    invalid ? styles.invalid : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <input
      ref={ref}
      type={type}
      id={id}
      name={name}
      value={value ?? ''}
      onChange={onChange}
      onInput={type === 'date' ? onChange : undefined}
      placeholder={typeof placeholder === 'string' ? t(placeholder) : placeholder}
      disabled={disabled}
      readOnly={readOnly}
      required={required}
      aria-invalid={invalid || undefined}
      aria-label={typeof ariaLabel === 'string' ? t(ariaLabel) : ariaLabel}
      className={classes}
      {...rest}
    />
  );
});

export default Input;
