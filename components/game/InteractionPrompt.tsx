"use client";

import { memo } from "react";
import { Keyboard, MousePointerClick } from "lucide-react";

export const InteractionPrompt = memo(function InteractionPrompt({
  visible,
  label,
}: {
  visible: boolean;
  label?: string;
}) {
  if (!visible || !label) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute left-1/2 top-24 z-30 -translate-x-1/2 md:top-auto md:bottom-8">
      <span className="pixel-hud inline-flex items-center gap-2 px-3 py-2 text-sm text-[#ddf5d9]">
        <span className="pixel-tile hidden h-6 w-6 place-items-center md:grid">
          <Keyboard className="h-4 w-4" />
        </span>
        <span className="pixel-tile grid h-6 w-6 place-items-center md:hidden">
          <MousePointerClick className="h-4 w-4" />
        </span>
        {label}
      </span>
    </div>
  );
});
