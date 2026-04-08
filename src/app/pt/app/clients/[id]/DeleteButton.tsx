"use client";

import { useFormStatus } from "react-dom";

export function DeleteButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!confirm("Are you sure you want to delete this client? This action cannot be undone.")) {
          e.preventDefault();
        }
      }}
      style={{
        padding: "8px 16px",
        background: "#c00",
        color: "white",
        border: "none",
        borderRadius: 4,
        cursor: pending ? "not-allowed" : "pointer",
        opacity: pending ? 0.6 : 1,
      }}
    >
      {pending ? "Deleting..." : "Delete"}
    </button>
  );
}
