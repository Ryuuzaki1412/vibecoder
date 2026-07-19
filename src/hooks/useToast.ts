import { useCallback, useState } from "react";

export type ToastKind = "info" | "success" | "error" | "warning";

export interface ToastItem {
  id: string;
  kind: ToastKind;
  message: string;
}

let _seq = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = `toast-${++_seq}`;
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  return {
    toasts,
    info: (msg: string) => push("info", msg),
    success: (msg: string) => push("success", msg),
    error: (msg: string) => push("error", msg),
    warn: (msg: string) => push("warning", msg),
  };
}