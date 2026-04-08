import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

export type ConfirmTone = "default" | "danger";

export type ConfirmDialogArgs = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
};

type ConfirmDialogState = ConfirmDialogArgs & {
  open: boolean;
};

const ConfirmContext = createContext<(args: ConfirmDialogArgs) => Promise<boolean>>(() => Promise.resolve(false));

export const ConfirmDialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ConfirmDialogState | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  useEffect(() => {
    return () => {
      if (resolveRef.current) {
        resolveRef.current(false);
        resolveRef.current = null;
      }
    };
  }, []);

  const confirm = (args: ConfirmDialogArgs) =>
    new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState({
        ...args,
        open: true,
        confirmLabel: args.confirmLabel ?? "Xác nhận",
        cancelLabel: args.cancelLabel ?? "Hủy",
        tone: args.tone ?? "default",
      });
    });

  const close = (value: boolean) => {
    setState(null);
    const r = resolveRef.current;
    resolveRef.current = null;
    if (r) r(value);
  };

  const value = useMemo(() => confirm, []);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {state ? (
        <div
          className="dialog-overlay"
          role="presentation"
          onMouseDown={() => close(false)}
        >
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-label={state.title}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="dialog-title">{state.title}</div>
            {state.message ? <div className="dialog-message">{state.message}</div> : null}

            <div className="dialog-actions">
              <button className="btn btn-secondary" type="button" onClick={() => close(false)}>
                {state.cancelLabel}
              </button>
              <button
                className={state.tone === "danger" ? "btn btn-danger" : "btn btn-primary"}
                type="button"
                onClick={() => close(true)}
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
};

export function useConfirm() {
  return useContext(ConfirmContext);
}

