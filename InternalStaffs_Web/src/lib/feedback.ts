/** Browser-safe toast store for the staff portal feedback stack. */
export type ToastTone = "success" | "warning" | "error" | "info";
export interface PortalToast {
  id: number;
  tone: ToastTone;
  title: string;
  detail?: string;
  action?: { label: string; onClick: () => void };
  duration: number;
}
type Listener = (toasts: PortalToast[]) => void;
let toasts: PortalToast[] = [];
let nextId = 1;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l(toasts));
export const MAX_TOASTS = 5;

export function pushToast(
  t: Omit<PortalToast, "id" | "duration"> & { duration?: number },
): number {
  const id = nextId++;
  toasts = [{ duration: 5000, ...t, id }, ...toasts].slice(0, MAX_TOASTS);
  emit();
  return id;
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function subscribeToasts(l: Listener) {
  listeners.add(l);
  l(toasts);
  return () => {
    listeners.delete(l);
  };
}

/** Reason-gated destructive actions need a non-blank explanation. */
export function canConfirm(requireReason: boolean, reason: string) {
  return !requireReason || reason.trim().length >= 5;
}
