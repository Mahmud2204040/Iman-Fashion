/**
 * Inline-SVG icon set used by the sidebar and stat cards.
 *
 * Hand-crafted (no library) so the visual style stays consistent and
 * the bundle stays small. Every icon is a 24x24 viewBox, stroke-based,
 * with stroke-linecap="round" for the modern, soft-edged look.
 *
 * Each icon accepts the standard SVG props (size, color, etc.) so the
 * caller controls visual weight via `size` and `strokeWidth`.
 */

function makeIcon(path) {
  function Icon({
    size = 20,
    strokeWidth = 1.75,
    color = 'currentColor',
    ...rest
  }) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...rest}
      >
        {path}
      </svg>
    );
  }
  return Icon;
}

export const DashboardIcon = makeIcon(
  <>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </>,
);

export const SaleIcon = makeIcon(
  <>
    <path d="M4 4h2l1.5 12.5a2 2 0 0 0 2 1.7h7.6a2 2 0 0 0 2-1.6L20.5 8H6" />
    <circle cx="9" cy="21" r="1.25" />
    <circle cx="17" cy="21" r="1.25" />
    <path d="M9 11h7" />
  </>,
);

export const CustomerIcon = makeIcon(
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
  </>,
);

export const CustomOrderIcon = makeIcon(
  <>
    <path d="M3 6h18" />
    <path d="M5 6l1 14a2 2 0 0 0 2 1.7h8a2 2 0 0 0 2-1.7l1-14" />
    <path d="M9 10v6" />
    <path d="M15 10v6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </>,
);

export const ProductIcon = makeIcon(
  <>
    <path d="M21 8l-9-5-9 5 9 5 9-5z" />
    <path d="M3 8v8l9 5 9-5V8" />
    <path d="M12 13v8" />
  </>,
);

export const SupplierIcon = makeIcon(
  <>
    <path d="M3 7l9-4 9 4-9 4-9-4z" />
    <path d="M3 12l9 4 9-4" />
    <path d="M3 17l9 4 9-4" />
  </>,
);

export const PurchaseIcon = makeIcon(
  <>
    <path d="M12 3v12" />
    <path d="M7 10l5 5 5-5" />
    <path d="M5 21h14" />
  </>,
);

export const RawMaterialIcon = makeIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18" />
  </>,
);

export const ExpenseIcon = makeIcon(
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 10h18" />
    <path d="M7 15h4" />
  </>,
);

export const CashIcon = makeIcon(
  <>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="3" />
    <path d="M6 12h.01" />
    <path d="M18 12h.01" />
  </>,
);

export const ReportIcon = makeIcon(
  <>
    <path d="M4 4h16v16H4z" />
    <path d="M8 16v-4" />
    <path d="M12 16V8" />
    <path d="M16 16v-6" />
  </>,
);

export const MenuIcon = makeIcon(
  <>
    <line x1="4" y1="7" x2="20" y2="7" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="17" x2="20" y2="17" />
  </>,
);

export const CloseIcon = makeIcon(
  <>
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="6" y1="18" x2="18" y2="6" />
  </>,
);

export const LogoutIcon = makeIcon(
  <>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </>,
);

export const ArrowUpIcon = makeIcon(
  <>
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="6 11 12 5 18 11" />
  </>,
);

export const ArrowDownIcon = makeIcon(
  <>
    <line x1="12" y1="5" x2="12" y2="19" />
    <polyline points="6 13 12 19 18 13" />
  </>,
);

export const RefreshIcon = makeIcon(
  <>
    <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
    <polyline points="21 3 21 8 16 8" />
    <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
    <polyline points="3 21 3 16 8 16" />
  </>,
);

export const CalendarIcon = makeIcon(
  <>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18" />
    <path d="M8 3v4" />
    <path d="M16 3v4" />
  </>,
);

export const CashHandIcon = makeIcon(
  <>
    <path d="M3 17l4-4 4 4 6-6 4 4" />
    <path d="M3 21h18" />
  </>,
);

export const BoxIcon = makeIcon(
  <>
    <path d="M21 16V8l-9-5-9 5v8l9 5 9-5z" />
    <path d="M3.3 7L12 12l8.7-5" />
    <path d="M12 22V12" />
  </>,
);

export const ScissorsIcon = makeIcon(
  <>
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <line x1="20" y1="4" x2="8.12" y2="15.88" />
    <line x1="14.47" y1="14.48" x2="20" y2="20" />
    <line x1="8.12" y1="8.12" x2="12" y2="12" />
  </>,
);

export const SparklesIcon = makeIcon(
  <>
    <path d="M12 3l1.7 4.6L18 9.3l-4.3 1.7L12 15l-1.7-4-4.3-1.7 4.3-1.7z" />
    <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z" />
    <path d="M5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8z" />
  </>,
);

/* ---------- Sidebar expansion / actions ---------- */

export const ChevronDownIcon = makeIcon(
  <>
    <polyline points="6 9 12 15 18 9" />
  </>,
);

export const PlusIcon = makeIcon(
  <>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </>,
);

/* ---------- Sidebar item icons for the restructured nav ---------- */

export const HistoryIcon = makeIcon(
  <>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <polyline points="3 4 3 9 8 9" />
    <polyline points="12 7 12 12 15 14" />
  </>,
);

export const UserPlusIcon = makeIcon(
  <>
    <circle cx="9" cy="8" r="4" />
    <path d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7" />
    <line x1="19" y1="8" x2="19" y2="14" />
    <line x1="22" y1="11" x2="16" y2="11" />
  </>,
);

export const BookIcon = makeIcon(
  <>
    <path d="M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z" />
    <path d="M20 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z" />
  </>,
);

export const PackagePlusIcon = makeIcon(
  <>
    <path d="M21 8l-9-5-9 5 9 5 9-5z" />
    <path d="M3 8v8l9 5 9-5V8" />
    <line x1="12" y1="13" x2="12" y2="22" />
    <line x1="17" y1="11" x2="17" y2="15" />
    <line x1="15" y1="13" x2="19" y2="13" />
  </>,
);

export const SpoolIcon = makeIcon(
  <>
    <ellipse cx="12" cy="12" rx="9" ry="3" />
    <path d="M3 12v4c0 1.66 4.03 3 9 3s9-1.34 9-3v-4" />
    <path d="M3 8c0-1.66 4.03-3 9-3s9 1.34 9 3" />
    <path d="M12 3v18" />
  </>,
);

export const SpoolPlusIcon = makeIcon(
  <>
    <ellipse cx="12" cy="12" rx="9" ry="3" />
    <path d="M3 12v4c0 1.66 4.03 3 9 3s9-1.34 9-3v-4" />
    <path d="M3 8c0-1.66 4.03-3 9-3s9 1.34 9 3" />
    <line x1="19" y1="9" x2="19" y2="13" />
    <line x1="17" y1="11" x2="21" y2="11" />
  </>,
);

export const NoteIcon = makeIcon(
  <>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <line x1="9" y1="13" x2="15" y2="13" />
    <line x1="9" y1="17" x2="13" y2="17" />
  </>,
);

export const CheckIcon = makeIcon(
  <>
    <polyline points="4 12 10 18 20 6" />
  </>,
);