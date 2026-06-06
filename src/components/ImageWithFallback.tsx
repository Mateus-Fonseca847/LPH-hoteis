"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

type ImageWithFallbackProps = ImageProps & {
  fallbackLabel: string;
  wrapperClassName?: string;
};

export function ImageWithFallback({
  fallbackLabel,
  wrapperClassName = "",
  className,
  alt,
  onError,
  fill,
  src,
  priority,
  loading,
  decoding,
  ...props
}: ImageWithFallbackProps) {
  const hasInvalidSource = typeof src === "string" && !src.trim();
  const sourceKey = typeof src === "string" ? src : "";
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const hasError = hasInvalidSource || failedSource === sourceKey;
  const frameClassName = [
    "image-fallback-frame",
    fill ? "image-fallback-frame--fill" : "",
    hasError ? "is-failed" : "",
    wrapperClassName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={frameClassName}>
      {!hasError ? (
        <Image
          {...props}
          src={src}
          alt={alt}
          className={className}
          fill={fill}
          priority={priority}
          loading={priority ? undefined : (loading ?? "lazy")}
          decoding={decoding ?? "async"}
          onError={(event) => {
            setFailedSource(sourceKey);
            onError?.(event);
          }}
        />
      ) : null}
      <span className="image-fallback-frame__placeholder" aria-hidden={!hasError}>
        {fallbackLabel}
      </span>
    </span>
  );
}
