"use client";

import { useState, useCallback } from "react";
import ChangePasswordModal from "./ChangePasswordModal";

export default function SecurityCard() {
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm md:p-6">
        <h2 className="text-base font-semibold text-neutral-900 md:text-lg">Security</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Change your password for this account.
        </p>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center justify-center rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Change password
          </button>
        </div>
      </section>

      <ChangePasswordModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => showToast("Password updated", "success")}
        onError={(message) => showToast(message, "error")}
      />

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg px-5 py-3 text-sm font-medium text-white shadow-lg"
          style={{
            background: toast.type === "success" ? "#16a34a" : "#dc2626",
          }}
          role="status"
        >
          {toast.message}
        </div>
      )}
    </>
  );
}
