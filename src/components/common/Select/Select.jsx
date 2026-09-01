import { forwardRef } from 'react';
import styles from './Select.module.css';

/**
 * Native select — accessible by default.
 *
 * props:
 *   options: [{ value, label, disabled? }]
 *   value, onChange, placeholder (shown as a disabled option when value is empty)
 *   disabled, invalid, required, name, id, fullWidth, size, className
 */
const Select = forwardRef(function Select(
  {
    options = [],
    value,
    onChange,
    placeholder,
    disabled = false,
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
    styles.select,
    styles[`size-${size}`],
    fullWidth ? styles.fullWidth : '',
    invalid ? styles.invalid : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <select
      ref={ref}
      id={id}
      name={name}
      value={value ?? ''}
      onChange={onChange}
      disabled={disabled}
      required={required}
      aria-invalid={invalid || undefined}
      className={classes}
      {...rest}
    >
      {placeholder ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {options.map((opt) => (
        <option
          key={String(opt.value)}
          value={opt.value}
          disabled={opt.disabled}
        >
          {opt.label}
        </option>
      ))}
    </select>
  );
});

export default Select;
