// ============================================================
// Icon — minimal inline SVG icon set (no extra dependency)
// ============================================================

type IconName =
  | "search"
  | "plus"
  | "trash"
  | "settings"
  | "templates"
  | "rocket"
  | "sparkles"
  | "edit"
  | "check"
  | "x"
  | "eye"
  | "eye-off"
  | "moon"
  | "sun"
  | "copy"
  | "lightbulb"
  | "refresh"
  | "download";

export function Icon({
  name,
  size = 16,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "search":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
          <circle cx="11" cy="11" r="7" {...stroke} />
          <path d="m21 21-4.5-4.5" {...stroke} />
        </svg>
      );
    case "plus":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
          <path d="M12 5v14M5 12h14" {...stroke} />
        </svg>
      );
    case "trash":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" {...stroke} />
          <path d="M10 11v6M14 11v6" {...stroke} />
        </svg>
      );
    case "settings":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
          <circle cx="12" cy="12" r="3" {...stroke} />
          <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
            {...stroke}
          />
        </svg>
      );
    case "templates":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
          <rect x="3" y="3" width="7" height="9" rx="1" {...stroke} />
          <rect x="14" y="3" width="7" height="5" rx="1" {...stroke} />
          <rect x="14" y="12" width="7" height="9" rx="1" {...stroke} />
          <rect x="3" y="16" width="7" height="5" rx="1" {...stroke} />
        </svg>
      );
    case "rocket":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
          <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" {...stroke} />
          <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" {...stroke} />
          <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" {...stroke} />
          <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" {...stroke} />
        </svg>
      );
    case "sparkles":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
          <path d="M12 3v3m0 12v3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M3 12h3m12 0h3M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1" {...stroke} />
          <circle cx="12" cy="12" r="3" {...stroke} />
        </svg>
      );
    case "edit":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
          <path d="M12 20h9" {...stroke} />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" {...stroke} />
        </svg>
      );
    case "check":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
          <path d="m20 6-11 11-5-5" {...stroke} />
        </svg>
      );
    case "x":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
          <path d="M18 6 6 18M6 6l12 12" {...stroke} />
        </svg>
      );
    case "eye":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" {...stroke} />
          <circle cx="12" cy="12" r="3" {...stroke} />
        </svg>
      );
    case "eye-off":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" {...stroke} />
          <path d="m1 1 22 22" {...stroke} />
        </svg>
      );
    case "moon":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" {...stroke} />
        </svg>
      );
    case "sun":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
          <circle cx="12" cy="12" r="4" {...stroke} />
          <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41" {...stroke} />
        </svg>
      );
    case "copy":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
          <rect x="9" y="9" width="13" height="13" rx="2" {...stroke} />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" {...stroke} />
        </svg>
      );
    case "lightbulb":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
          <path d="M9 18h6m-5 4h4M12 2a7 7 0 0 0-4 12.7c1 .86 1.5 1.5 1.5 2.8h5c0-1.3.5-1.94 1.5-2.8A7 7 0 0 0 12 2z" {...stroke} />
        </svg>
      );
    case "refresh":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
          <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" {...stroke} />
          <path d="M21 3v5h-5" {...stroke} />
          <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" {...stroke} />
          <path d="M3 21v-5h5" {...stroke} />
        </svg>
      );
    case "download":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
          <path d="M12 3v12m0 0l-4-4m4 4l4-4" {...stroke} />
          <path d="M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2" {...stroke} />
        </svg>
      );
    default:
      return null;
  }
}

// ============================================================
// useTheme — light/dark
// (Legacy single-source theme toggle, kept for older callers. The
// canonical implementation now lives in src/hooks/useUISettings.ts
// which writes both the html class and the localStorage pref.)
// ============================================================

export type ThemeMode = "light" | "dark";