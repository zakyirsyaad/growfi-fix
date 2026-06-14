"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock } from "lucide-react";

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
    <span className="pixel-badge gap-1 text-[#8ad4ff]">
      <Clock className="h-3 w-3" />
      {label ? `${label}: ` : null}
      {formatDuration(target)}
    </span>
  );
}
