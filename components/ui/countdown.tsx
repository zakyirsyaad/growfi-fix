"use client";

import { useEffect, useMemo, useState } from "react";

function formatDuration(ms: number) {
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

export function Countdown({ to }: { to?: string | Date | null }) {
  const target = useMemo(() => (to ? new Date(to).getTime() : null), [to]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!target) {
    return <span>ready</span>;
  }

  return <span>{formatDuration(target - now)}</span>;
}
