"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { getBrandLogoUrl, isBrandingUnlocked } from "@/lib/branding";

type Profile = { brand_logo_url?: string | null; subscription_tier?: string | null } | null;

export default function BrandingPage() {
  const [profile, setProfile] = useState<Profile>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/billing/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setProfile(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const logoUrl = getBrandLogoUrl(profile);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const allowed = ["image/png", "image/svg+xml", "image/webp"];
    if (!allowed.includes(file.type)) {
      setError("Invalid file type. Use PNG, SVG, or WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("File too large. Maximum size is 2MB.");
      return;
    }

    setError(null);
    setSuccess(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/pt/upload-logo", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }
      const url = data.url;
      const patchRes = await fetch("/api/billing/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_logo_url: url }),
      });
      if (!patchRes.ok) {
        setError("Upload succeeded but saving failed. Try again.");
        return;
      }
      setProfile((p) => (p ? { ...p, brand_logo_url: url } : { brand_logo_url: url }));
      setSuccess("Logo updated. It will appear in the sidebar and on share pages.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleReset = async () => {
    setError(null);
    setSuccess(null);
    setResetting(true);
    try {
      const res = await fetch("/api/billing/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_logo_url: null }),
      });
      if (!res.ok) {
        setError("Failed to reset logo");
        return;
      }
      setProfile((p) => (p ? { ...p, brand_logo_url: null } : null));
      setSuccess("Logo reset to Milo Hub. It will update across the app.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset");
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-lg">
        <p className="text-sm text-neutral-500">Loading…</p>
      </div>
    );
  }

  if (!isBrandingUnlocked(profile?.subscription_tier)) {
    return (
      <div className="max-w-lg space-y-6">
        <h1 className="text-xl font-semibold text-neutral-900">Branding is a Pro feature</h1>
        <p className="text-sm text-neutral-600">
          Upgrade to Pro to upload your logo and brand client plans.
        </p>
        <ul className="list-disc list-inside space-y-2 text-sm text-neutral-700">
          <li>Upload your logo</li>
          <li>Brand client plans</li>
          <li>Professional share pages & exports</li>
        </ul>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/pt/app/billing"
            className="min-h-[44px] rounded-lg px-4 font-medium bg-neutral-900 text-white hover:bg-neutral-800 inline-flex items-center justify-center"
          >
            Upgrade to Pro
          </Link>
          <Link
            href="/pt/app/billing"
            className="min-h-[44px] rounded-lg px-4 font-medium border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 inline-flex items-center justify-center"
          >
            See plans
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">Branding</h1>
      <p className="text-sm text-neutral-600">
        Your logo appears in the PT Hub sidebar, on client share links, and in PDF exports.
      </p>

      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">
          Current logo
        </p>
        <div className="flex items-center gap-4">
          <img
            src={logoUrl}
            alt=""
            className="h-10 w-auto max-w-[180px] object-contain object-left border border-neutral-100 rounded bg-white"
          />
          <span className="text-sm text-neutral-500">
            {profile?.brand_logo_url ? "Custom logo" : "Default Milo Hub logo"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".png,.svg,.webp,image/png,image/svg+xml,image/webp"
          className="hidden"
          onChange={handleUpload}
          disabled={uploading}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="min-h-[44px] rounded-lg px-4 font-medium bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Upload logo"}
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={resetting || !profile?.brand_logo_url}
          className="min-h-[44px] rounded-lg px-4 font-medium border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {resetting ? "Resetting…" : "Reset to Milo Hub logo"}
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        PNG, SVG or WebP. Recommended: transparent background. Max 2MB.
      </p>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
        </div>
      )}
    </div>
  );
}
