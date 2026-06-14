"use client";

import { useQuery } from "@tanstack/react-query";
import { ResponsivePanel } from "@/components/game/overlays/ResponsivePanel";
import {
  EmptyState,
  LoadingState,
} from "@/components/game/shared/StatusStates";
import { apiFetch } from "@/lib/utils/fetcher";

type ActivityResponse = {
  logs: Array<{ id: string; type: string; message: string; createdAt: string }>;
};

export function ActivityLogOverlay({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["activity"],
    queryFn: () => apiFetch<ActivityResponse>("/api/activity"),
    enabled: open,
  });

  return (
    <ResponsivePanel
      open={open}
      onOpenChange={onOpenChange}
      title="Mailbox & Activity"
      description="Notification history from farming, wallet, marketplace, quests, and trades."
    >
      {isLoading || !data ? (
        <LoadingState label="Loading activity" />
      ) : data.logs.length === 0 ? (
        <EmptyState title="No activity yet" />
      ) : (
        <div className="space-y-2">
          {data.logs.map((log) => (
            <div key={log.id} className="pixel-card p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="font-semibold text-[#f2fbf1]">
                  {log.message}
                </div>
                <span className="pixel-badge text-[#91d985]">
                  {log.type.toLowerCase().replaceAll("_", " ")}
                </span>
              </div>
              <div className="mt-1 text-xs text-[#5e8c52]">
                {new Date(log.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </ResponsivePanel>
  );
}
