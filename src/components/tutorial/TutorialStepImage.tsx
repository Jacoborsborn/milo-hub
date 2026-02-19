"use client";

import ExpandableImage from "@/components/ui/ExpandableImage";

type TutorialStepImageProps = {
  src: string;
  alt: string;
};

export default function TutorialStepImage({ src, alt }: TutorialStepImageProps) {
  return <ExpandableImage src={src} alt={alt} />;
}
