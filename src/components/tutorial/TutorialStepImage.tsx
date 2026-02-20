"use client";

type TutorialStepImageProps = {
  src: string;
  alt: string;
};

export default function TutorialStepImage({ src, alt }: TutorialStepImageProps) {
  return (
    <div className="relative w-full overflow-hidden rounded-xl border bg-muted/30">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        style={{ width: "100%", height: "auto", borderRadius: 12 }}
      />
    </div>
  );
}
