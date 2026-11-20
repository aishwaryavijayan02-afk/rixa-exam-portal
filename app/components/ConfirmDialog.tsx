"use client";

import React, { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { AlertTriangle, HelpCircle } from "lucide-react";

/**
 * In-app replacement for window.confirm().
 *
 * The native confirm() dialog is suppressed in some embedded browsers (it
 * returns `false` immediately without showing anything), which made every
 * "Delete" / "Clear All" button silently do nothing. This renders a real modal
 * and resolves with the user's choice.
 *
 *   if (!(await confirmDialog("Delete 3 questions?", { danger: true }))) return;
 */
export interface ConfirmDialogOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red styling for destructive actions (delete, clear). */
  danger?: boolean;
  /** Show only the confirm button (an in-app alert). */
  hideCancel?: boolean;
}

function ConfirmModal({
  message,
  options,
  onClose,
}: {
  message: string;
  options: ConfirmDialogOptions;
  onClose: (result: boolean) => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const danger = Boolean(options.danger);
  // Non-destructive confirms (Verify / Approve) use the same dark brown as the
  // "Verify & Forward" button on the Verify & Approval page.
  const accent = danger ? "#dc2626" : "#5a3a24";

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={() => onClose(false)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 5000,
        background: "rgba(40, 26, 17, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: options.hideCancel ? "520px" : "420px",
          background: "#ffffff",
          borderRadius: "16px",
          padding: "22px",
          boxShadow: "0 24px 60px rgba(40, 26, 17, 0.3)",
          fontFamily: "var(--font-inter), 'Inter', -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
          <div
            style={{
              flexShrink: 0,
              width: "40px",
              height: "40px",
              borderRadius: "12px",
              background: danger ? "#fef2f2" : "#eef2ff",
              color: accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {danger ? <AlertTriangle size={20} /> : <HelpCircle size={20} />}
          </div>
          <div style={{ minWidth: 0 }}>
            <div id="confirm-dialog-title" style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a", marginBottom: "6px" }}>
              {options.title || (danger ? "Are you sure?" : "Please confirm")}
            </div>
            <div id="confirm-dialog-message" style={{ fontSize: "13.5px", lineHeight: 1.5, color: "#475569", wordBreak: "break-word", whiteSpace: "pre-line", maxHeight: "50vh", overflowY: "auto" }}>
              {message}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "22px" }}>
          {!options.hideCancel && <button
            type="button"
            onClick={() => onClose(false)}
            style={{
              padding: "9px 16px",
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              color: "#334155",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {options.cancelLabel || "Cancel"}
          </button>}
          <button
            ref={confirmRef}
            type="button"
            onClick={() => onClose(true)}
            className="confirm-dialog-primary"
            style={{
              padding: "9px 18px",
              borderRadius: "10px",
              border: `1px solid ${danger ? accent : "#3b2416"}`,
              background: danger ? accent : "linear-gradient(135deg, #3b2416 0%, #5a3a24 100%)",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: danger ? "none" : "0 6px 16px rgba(42, 26, 15, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.14)",
              outline: "none",
            }}
          >
            {options.confirmLabel || (danger ? "Delete" : "Confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function confirmDialog(message: string, options: ConfirmDialogOptions = {}): Promise<boolean> {
  if (typeof document === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    const host = document.createElement("div");
    host.setAttribute("data-confirm-dialog", "");
    document.body.appendChild(host);
    const root = createRoot(host);
    let settled = false;
    const close = (result: boolean) => {
      if (settled) return;
      settled = true;
      root.unmount();
      host.remove();
      resolve(result);
    };
    root.render(<ConfirmModal message={message} options={options} onClose={close} />);
  });
}

/** In-app replacement for window.alert(): resolves when the user clicks OK. */
export function alertDialog(message: string, options: Omit<ConfirmDialogOptions, "hideCancel"> = {}): Promise<void> {
  return confirmDialog(message, { danger: true, confirmLabel: "OK", ...options, hideCancel: true }).then(() => undefined);
}
