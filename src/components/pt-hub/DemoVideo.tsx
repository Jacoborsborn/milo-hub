"use client";

/**
 * Responsive demo video/gif block. Prevents layout shift with fixed aspect ratio.
 * Pass src when you have an asset (e.g. /demo/walkthrough.mp4 or .gif); otherwise shows placeholder.
 */
export default function DemoVideo({
  src = null,
  poster,
}: {
  src?: string | null;
  poster?: string;
}) {
  const isGif = src?.toLowerCase().endsWith(".gif");

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-neutral-900"
      style={{ aspectRatio: "16/9" }}
    >
      {src ? (
        isGif ? (
          <img
            src={src}
            alt="PT Hub walkthrough"
            className="h-full w-full object-contain object-center"
            loading="lazy"
            decoding="async"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        ) : (
          <video
            src={src}
            poster={poster}
            className="h-full w-full object-contain object-center"
            playsInline
            muted
            loop
            preload="metadata"
            controls
            aria-label="PT Hub 20 second walkthrough"
          >
            Your browser does not support the video tag.
          </video>
        )
      ) : (
        <div className="flex h-full w-full items-center justify-center text-center text-sm text-white/50">
          <span>
            Demo video coming soon
            <br />
            <span className="text-xs">(add mp4 or gif to /public and set src)</span>
          </span>
        </div>
      )}
    </div>
  );
}
