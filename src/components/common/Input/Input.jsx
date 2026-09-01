import { forwardRef } from 'react';
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
    ...rest
  },
  ref,
) {
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
      placeholder={placeholder}
      disabled={disabled}
      readOnly={readOnly}
      required={required}
      aria-invalid={invalid || undefined}
      className={classes}
      {...rest}
    />
  );
});

export default Input;
