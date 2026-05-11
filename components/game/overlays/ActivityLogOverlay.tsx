"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { ResponsivePanel } from "@/components/game/overlays/ResponsivePanel";
import { EmptyState, LoadingState } from "@/components/game/shared/StatusStates";
import { apiFetch } from "@/lib/utils/fetcher";

type ActivityResponse = {
  logs: Array<{ id: string; type: string; message: string; createdAt: string }>;
};

export function ActivityLogOverlay({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["activity"],
    queryFn: () => apiFetch<ActivityResponse>("/api/activity"),
    enabled: open
  });

  return (
    <ResponsivePanel open={open} onOpenChange={onOpenChange} title="Mailbox & Activity" description="Notification history from farming, wallet, marketplace, quests, and trades.">
      {isLoading || !data ? (
        <LoadingState label="Loading activity" />
      ) : data.logs.length === 0 ? (
        <EmptyState title="No activity yet" />
      ) : (
        <div className="space-y-2">
          {data.logs.map((log) => (
            <div key={log.id} className="rounded-md bg-white/75 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="font-semibold">{log.message}</div>
                <Badge variant="outline">{log.type.toLowerCase().replaceAll("_", " ")}</Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </ResponsivePanel>
  );
}
