import { useEffect, useRef } from "react";

// ============================================================
// ConfirmDialog — native-feeling confirmation modal
// Replaces window.confirm() which is unreliable in Tauri webview.
// ============================================================

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean; // use accent color for confirm button
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "确认",
  cancelLabel = "取消",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Focus the confirm button on mount + ESC to cancel
  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, onConfirm]);

  return (
    <div
      className="modal-backdrop"
      onClick={onCancel}
      style={{ zIndex: 1500 }}
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 420 }}
      >
        <div className="modal-header">
          <h2>{title}</h2>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-muted)" }}>
            {message}
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            className="btn-primary"
            onClick={onConfirm}
            style={
              danger
                ? { background: "var(--danger, #b53333)" }
                : undefined
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}