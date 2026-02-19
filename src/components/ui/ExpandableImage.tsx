"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

function Maximize2Icon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M15 3h6v6" />
      <path d="M9 21H3v-6" />
      <path d="M21 3l-7 7" />
      <path d="M3 21l7-7" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export type ExpandableImageProps = {
  src: string;
  alt: string;
  /** Outer container (rounded, overflow hidden). Default: rounded-xl border bg-muted/30 */
  containerClassName?: string;
  /** Clickable image wrapper (aspect ratio or height). Default: aspect-[16/9] */
  imageWrapperClassName?: string;
};

const defaultContainerClass = "relative w-full overflow-hidden rounded-xl border bg-muted/30";
const defaultImageWrapperClass = "relative aspect-[16/9] w-full cursor-zoom-in";

export default function ExpandableImage({
  src,
  alt,
  containerClassName = defaultContainerClass,
  imageWrapperClassName = defaultImageWrapperClass,
}: ExpandableImageProps) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (failed) {
    return (
      <div className={containerClassName}>
        <div className={imageWrapperClassName} />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <p className="text-sm font-medium">Screenshot Placeholder</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add an image at <span className="font-mono">{src}</span>
          </p>
          <p className="mt-3 text-[11px] text-muted-foreground">{alt}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={containerClassName}>
        <div
          className={imageWrapperClassName}
          onClick={() => setOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setOpen(true);
          }}
          aria-label="Open image preview"
        >
          <Image
            src={src}
            alt={alt}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
            onError={() => setFailed(true)}
            priority={false}
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
            }}
            className="absolute right-3 top-3 inline-flex items-center justify-center rounded-md border bg-background/80 p-2 text-foreground shadow-sm backdrop-blur hover:bg-background cursor-pointer"
            aria-label="Expand image"
            title="Expand"
          >
            <Maximize2Icon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Expanded image"
        >
          <div
            className="relative w-full max-w-6xl overflow-hidden rounded-2xl border bg-background shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 z-10 inline-flex items-center justify-center rounded-md border bg-background/90 p-2 text-foreground shadow-sm backdrop-blur hover:bg-background cursor-pointer"
              aria-label="Close"
              title="Close"
            >
              <XIcon className="h-4 w-4" />
            </button>
            <div className="relative w-full max-h-[85vh] overflow-hidden">
              <Image
                src={src}
                alt={alt}
                width={1600}
                height={900}
                className="h-auto w-full object-contain"
                sizes="100vw"
                priority
              />
            </div>
            <div className="border-t px-4 py-3 text-xs text-muted-foreground">
              Tip: Press <span className="font-medium">ESC</span> to close.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
