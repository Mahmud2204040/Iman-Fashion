import styles from './Card.module.css';

/**
 * Card — the canonical surface used across the app.
 *
 * Visual contract:
 *   - White surface, subtle border, 14px radius.
 *   - Minimal shadow that deepens on hover.
 *   - Padding defaults to `--space-5` (20px) — feels generous on
 *     desktop, comfortable on mobile.
 *   - Optional `interactive` for clickable cards (rows, links).
 *
 * Composition is the whole point: a Card should never need
 * bespoke padding or border-radius from the page that uses it.
 */
function Card({
  as = 'section',
  children,
  className = '',
  padding = 'md',
  interactive = false,
  ...rest
}) {
  const Tag = as;
  const classes = [
    styles.card,
    styles[`padding-${padding}`],
    interactive ? styles.interactive : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}

/**
 * CardHeader / CardTitle / CardSubtitle / CardActions / CardBody / CardFooter
 *
 * Optional layout slots for a card. Pages that don't need them just
 * render <Card>...</Card>. The header is a flex row by default with
 * title-left + actions-right; it stacks on mobile.
 */
function CardHeader({ children, className = '', ...rest }) {
  return (
    <header className={[styles.header, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </header>
  );
}

function CardTitle({ children, className = '', as: As = 'h2', ...rest }) {
  return (
    <As className={[styles.title, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </As>
  );
}

function CardSubtitle({ children, className = '', ...rest }) {
  return (
    <p className={[styles.subtitle, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </p>
  );
}

function CardActions({ children, className = '', ...rest }) {
  return (
    <div className={[styles.actions, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  );
}

function CardBody({ children, className = '', ...rest }) {
  return (
    <div className={[styles.body, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  );
}

function CardFooter({ children, className = '', ...rest }) {
  return (
    <footer className={[styles.footer, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </footer>
  );
}

Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Subtitle = CardSubtitle;
Card.Actions = CardActions;
Card.Body = CardBody;
Card.Footer = CardFooter;

export default Card;
