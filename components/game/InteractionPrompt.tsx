"use client";

import { Keyboard, MousePointerClick } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function InteractionPrompt({
  visible,
  label
}: {
  visible: boolean;
  label?: string;
}) {
  if (!visible || !label) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute left-1/2 top-24 z-30 -translate-x-1/2 md:top-auto md:bottom-8">
      <Badge variant="secondary" className="gap-2 border bg-white/90 px-3 py-2 text-sm shadow-sm backdrop-blur">
        <Keyboard className="hidden h-4 w-4 md:block" />
        <MousePointerClick className="h-4 w-4 md:hidden" />
        {label}
      </Badge>
    </div>
  );
}
