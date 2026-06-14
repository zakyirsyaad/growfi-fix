"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function formatDuration(target?: string | Date | null) {
  if (!target) {
    return "ready";
  }
  const ms = new Date(target).getTime() - Date.now();
  if (ms <= 0) {
    return "ready";
  }
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function CountdownBadge({
  to,
  label,
}: {
  to?: string | Date | null;
  label?: string;
}) {
  const target = useMemo(() => to, [to]);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <Badge variant="outline" className="gap-1 bg-white/80">
      <Clock className="h-3.5 w-3.5" />
      {label ? `${label}: ` : null}
      {formatDuration(target)}
    </Badge>
  );
}
