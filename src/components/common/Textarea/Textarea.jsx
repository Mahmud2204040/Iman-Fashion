import { forwardRef } from 'react';
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
    ...rest
  },
  ref,
) {
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
      placeholder={placeholder}
      disabled={disabled}
      readOnly={readOnly}
      required={required}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={classes}
      {...rest}
    />
  );
});

export default Textarea;
