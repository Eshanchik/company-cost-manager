"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

function hostFrom(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const withProto = /^https?:\/\//.test(url) ? url : `https://${url}`;
    return new URL(withProto).hostname;
  } catch {
    return null;
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

export function ServiceFavicon({
  vendorUrl,
  name,
  size = 24,
  className,
}: {
  vendorUrl: string | null | undefined;
  name: string;
  size?: number;
  className?: string;
}) {
  const host = hostFrom(vendorUrl);
  const [failed, setFailed] = React.useState(false);
  const showImage = host && !failed;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-[10px] font-semibold text-muted-foreground",
        className
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://www.google.com/s2/favicons?domain=${host}&sz=64`}
          alt=""
          width={size}
          height={size}
          onError={() => setFailed(true)}
          className="size-full object-contain"
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}
