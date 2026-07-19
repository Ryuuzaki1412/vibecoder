import type { NoteStatus } from "../types";
import { NOTE_STATUS_LABELS } from "../types";

// ============================================================
// StatusIndicator — small colored badge + optional text label
// ============================================================

interface StatusIndicatorProps {
  status: NoteStatus;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  onCycle?: () => void;
}

const COLORS: Record<NoteStatus, { dot: string; bg: string; text: string; border: string }> = {
  not_started: {
    dot: "var(--text-subtle)",
    bg: "rgba(138, 132, 120, 0.12)",
    text: "var(--text-muted)",
    border: "rgba(138, 132, 120, 0.30)",
  },
  in_progress: {
    dot: "var(--accent)",
    bg: "var(--accent-soft)",
    text: "var(--accent-text)",
    border: "rgba(201, 100, 66, 0.30)",
  },
  completed: {
    dot: "var(--success)",
    bg: "rgba(93, 126, 90, 0.12)",
    text: "var(--success)",
    border: "rgba(93, 126, 90, 0.30)",
  },
};

const ICONS: Record<NoteStatus, string> = {
  not_started: "○",   // circle
  in_progress: "◐",   // half-filled
  completed: "●",     // filled
};

export function StatusIndicator({
  status,
  showLabel = true,
  size = "md",
  onClick,
  onCycle,
}: StatusIndicatorProps) {
  const c = COLORS[status];
  const iconSize = size === "sm" ? 10 : size === "lg" ? 16 : 13;
  const dotR = size === "sm" ? 4 : size === "lg" ? 7 : 5;

  const interactive = !!(onClick || onCycle);
  const handleClick = () => {
    if (onCycle) onCycle();
    else if (onClick) onClick();
  };

  if (!showLabel) {
    // Compact: just a colored dot (or icon)
    return (
      <span
        className={`status-dot ${interactive ? "clickable" : ""}`}
        title={NOTE_STATUS_LABELS[status]}
        onClick={handleClick}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: dotR * 2,
          height: dotR * 2,
          borderRadius: "50%",
          background: c.bg,
          border: `1px solid ${c.border}`,
          color: c.dot,
          fontSize: iconSize,
          lineHeight: 1,
          cursor: interactive ? "pointer" : "default",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: iconSize, color: c.dot }}>{ICONS[status]}</span>
      </span>
    );
  }

  return (
    <span
      className={`status-badge ${interactive ? "clickable" : ""}`}
      onClick={handleClick}
      title={
        interactive
          ? `点击切换状态(当前:${NOTE_STATUS_LABELS[status]})`
          : NOTE_STATUS_LABELS[status]
      }
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: size === "sm" ? "2px 7px" : "3px 9px",
        borderRadius: 10,
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
        fontSize: size === "sm" ? 11 : 12,
        fontWeight: 500,
        cursor: interactive ? "pointer" : "default",
        userSelect: "none",
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: iconSize, color: c.dot, lineHeight: 1 }}>
        {ICONS[status]}
      </span>
      <span>{NOTE_STATUS_LABELS[status]}</span>
    </span>
  );
}