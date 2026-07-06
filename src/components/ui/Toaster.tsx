"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Toast, type ToastTone } from "./Toast";
import styles from "./Toaster.module.css";

export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
};

type QueuedToast = ToastInput & { id: number; leaving: boolean };

type ToastContextValue = { toast: (input: ToastInput) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export const TOAST_DURATION_MS = 3500;
/** Matches --duration-slow (the exit animation length). */
export const TOAST_EXIT_MS = 280;

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToasterProvider>");
  return ctx;
}

export function ToasterProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<QueuedToast[]>([]);
  const [mounted, setMounted] = useState(false); // portal target exists only client-side
  const nextId = useRef(1);

  useEffect(() => {
    // Client-only mount flag: guards `createPortal(..., document.body)` below
    // from running during SSR/server rendering, where `document` is
    // undefined. This is the standard mount-detection idiom and has no
    // setState-free equivalent.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const beginExit = useCallback((id: number) => {
    setToasts((ts) =>
      ts.map((t) => (t.id === id ? { ...t, leaving: true } : t))
    );
    window.setTimeout(() => {
      setToasts((ts) => ts.filter((t) => t.id !== id));
    }, TOAST_EXIT_MS);
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      setToasts((ts) => [...ts, { id, leaving: false, ...input }]);
      window.setTimeout(() => beginExit(id), TOAST_DURATION_MS);
    },
    [beginExit]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div className={styles.viewport} aria-live="polite">
            {toasts.map((t) => (
              <div
                key={t.id}
                className={t.leaving ? styles.itemLeaving : styles.item}
              >
                <Toast
                  tone={t.tone ?? "success"}
                  title={t.title}
                  description={t.description}
                  onClose={() => beginExit(t.id)}
                />
              </div>
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}
