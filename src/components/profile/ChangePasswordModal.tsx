"use client";

import { useEffect, useCallback, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

const RULES = [
  { id: "len", label: "At least 8 characters", test: (s: string) => s.length >= 8 },
  { id: "upper", label: "At least 1 uppercase letter", test: (s: string) => /[A-Z]/.test(s) },
  { id: "lower", label: "At least 1 lowercase letter", test: (s: string) => /[a-z]/.test(s) },
  { id: "number", label: "At least 1 number", test: (s: string) => /\d/.test(s) },
  { id: "special", label: "At least 1 special character", test: (s: string) => /[^A-Za-z0-9]/.test(s) },
] as const;

function checkAllRules(password: string) {
  return RULES.every((r) => r.test(password));
}

export type ChangePasswordModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError: (message: string) => void;
};

export default function ChangePasswordModal({
  isOpen,
  onClose,
  onSuccess,
  onError,
}: ChangePasswordModalProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitTried, setSubmitTried] = useState(false);

  const rulesOk = checkAllRules(newPassword);
  const confirmMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = rulesOk && confirmMatch;

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, handleEscape]);

  useEffect(() => {
    if (!isOpen) {
      setNewPassword("");
      setConfirmPassword("");
      setShowNew(false);
      setShowConfirm(false);
      setLoading(false);
      setSubmitTried(false);
    }
  }, [isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitTried(true);
    if (!canSubmit) return;

    setLoading(true);
    try {
      const { error } = await supabaseBrowser().auth.updateUser({ password: newPassword });
      if (error) {
        const msg = error.message || "Failed to update password.";
        if (
          msg.toLowerCase().includes("re-auth") ||
          msg.toLowerCase().includes("reauthenticate") ||
          error.status === 422
        ) {
          onError("Your session may have expired. Please sign out and use “Forgot password” to set a new password.");
        } else {
          onError(msg);
        }
        return;
      }
      onSuccess();
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="change-password-title" className="text-lg font-semibold text-neutral-900">
            Change password
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-neutral-600">
              New password
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-base focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                placeholder="Enter new password"
              />
              <button
                type="button"
                onClick={() => setShowNew((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500 hover:text-neutral-700"
                aria-label={showNew ? "Hide password" : "Show password"}
              >
                {showNew ? "Hide" : "Show"}
              </button>
            </div>
            <ul className="mt-2 space-y-1 text-sm text-neutral-600">
              {RULES.map((r) => (
                <li
                  key={r.id}
                  className={r.test(newPassword) ? "text-emerald-600" : "text-neutral-500"}
                >
                  {r.test(newPassword) ? "✓" : "○"} {r.label}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-neutral-600">
              Confirm new password
            </label>
            <div className="relative">
              <input
                id="confirm-password"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-base focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                placeholder="Confirm new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500 hover:text-neutral-700"
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? "Hide" : "Show"}
              </button>
            </div>
            {submitTried && confirmPassword.length > 0 && !confirmMatch && (
              <p className="mt-1 text-sm text-rose-600">Passwords do not match.</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="flex-1 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? "Updating…" : "Update password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
