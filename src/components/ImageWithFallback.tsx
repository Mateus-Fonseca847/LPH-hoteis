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
  ...props
}: ImageWithFallbackProps) {
  const [hasError, setHasError] = useState(false);
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
          alt={alt}
          className={className}
          fill={fill}
          onError={(event) => {
            setHasError(true);
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
