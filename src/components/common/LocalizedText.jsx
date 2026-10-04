import { useLocale } from '../../contexts/LocaleContext.jsx';

/** Translate a fixed JSX text node while preserving its surrounding spacing. */
export default function LocalizedText({ children }) {
  const { t } = useLocale();
  if (typeof children !== 'string') return children;
  const leading = children.match(/^\s*/)?.[0] || '';
  const trailing = children.match(/\s*$/)?.[0] || '';
  const key = children.trim().replace(/\s+/g, ' ');
  return key ? `${leading}${t(key)}${trailing}` : children;
}
