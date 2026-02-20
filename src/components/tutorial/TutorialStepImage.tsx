"use client";

import { useEffect, useState } from "react";

type TutorialStepImageProps = {
  src: string;
  alt: string;
};

const IMG_WIDTH = 800;
const IMG_HEIGHT = 450;

/** Ensures src is absolute (leading slash). public/ files are served from root. */
function ensureAbsolutePath(src: string): string {
  const trimmed = src?.trim() ?? "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export default function TutorialStepImage({ src, alt }: TutorialStepImageProps) {
  const absoluteSrc = ensureAbsolutePath(src);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("[TutorialStepImage] src:", absoluteSrc);
    }
  }, [absoluteSrc]);

  if (loadError) {
    return (
      <div
        className="flex min-h-[200px] w-full items-center justify-center rounded-xl border border-neutral-200 bg-muted/30"
        style={{ borderRadius: 12 }}
      >
        <span className="text-sm text-muted-foreground">{alt}</span>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-neutral-200 bg-muted/30">
      <img
        src={absoluteSrc}
        alt={alt}
        width={IMG_WIDTH}
        height={IMG_HEIGHT}
        loading="eager"
        decoding="async"
        onError={() => setLoadError(true)}
        style={{ width: "100%", height: "auto", borderRadius: 12 }}
      />
    </div>
  );
}
