import React, { createContext, useContext, useMemo, useRef, useState } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export type ToastPushArgs = {
  type: ToastType;
  title: string;
  message?: string;
};

type ToastItem = ToastPushArgs & {
  id: string;
};

const ToastContext = createContext<(args: ToastPushArgs) => void>(() => {});

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Record<string, number>>({});

  const pushToast = (args: ToastPushArgs) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const item: ToastItem = { ...args, id };
    setToasts((prev) => [...prev, item]);

    // Auto remove after a short duration.
    const timerId = window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      delete timersRef.current[id];
    }, 3500);
    timersRef.current[id] = timerId;
  };

  const value = useMemo(() => pushToast, []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container" aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <div className="toast-title">{t.title}</div>
            {t.message ? <div className="toast-message">{t.message}</div> : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  return useContext(ToastContext);
}

