"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Coins, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { ResponsivePanel } from "@/components/game/overlays/ResponsivePanel";
import { LoadingState } from "@/components/game/shared/StatusStates";
import { apiFetch } from "@/lib/utils/fetcher";

type Quest = {
  id: string;
  questKey: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  rewardGrow: number;
  claimed: boolean;
  completed: boolean;
  expiresAt: string;
};

type QuestResponse = { quests: Quest[] };

export function QuestBoardOverlay({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["quests"],
    queryFn: () => apiFetch<QuestResponse>("/api/quests"),
    enabled: open,
  });

  const claimMutation = useMutation({
    mutationFn: (questKey: string) =>
      apiFetch<QuestResponse>("/api/quests", {
        method: "POST",
        body: JSON.stringify({ questKey }),
      }),
    onSuccess: async () => {
      toast.success("Daily quest reward claimed");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["quests"] }),
        queryClient.invalidateQueries({ queryKey: ["garden"] }),
        queryClient.invalidateQueries({ queryKey: ["me"] }),
        queryClient.invalidateQueries({ queryKey: ["activity"] }),
      ]);
    },
    onError: (err) => {
      toast.error("Could not claim quest", {
        description: err instanceof Error ? err.message : "Try again later.",
      });
    },
  });

  return (
    <ResponsivePanel
      open={open}
      onOpenChange={onOpenChange}
      title="Daily Quest Board"
      description="Small daily goals that reward in-game $GROW. Economy actions remain server validated."
    >
      {isLoading || !data ? (
        <LoadingState label="Loading daily quests" />
      ) : (
        <div className="space-y-3">
          {data.quests.map((quest) => {
            const complete = quest.progress >= quest.target;

            return (
              <div key={quest.questKey} className="pixel-card space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="pixel-card-sunken grid h-10 w-10 place-items-center text-[#3d9f4b]">
                      <ListChecks className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="font-black text-[#f2fbf1]">
                        {quest.title}
                      </div>
                      <div className="text-sm text-[#91d985]">
                        {Math.min(quest.progress, quest.target)}/{quest.target}
                      </div>
                    </div>
                  </div>
                  <span className="pixel-badge gap-1 text-[#f7d767]">
                    <Coins className="h-3.5 w-3.5" />
                    {quest.rewardGrow}
                  </span>
                </div>
                <p className="font-sans text-sm text-[#91d985]">
                  {quest.description}
                </p>
                <div className="pixel-progress">
                  <span
                    style={{
                      width: `${(Math.min(quest.progress, quest.target) / quest.target) * 100}%`,
                    }}
                  />
                </div>
                <div className="text-xs font-semibold text-[#5e8c52]">
                  Expires {new Date(quest.expiresAt).toLocaleTimeString()}
                </div>
                <button
                  type="button"
                  className={`pixel-btn w-full px-4 py-2 ${quest.claimed ? "pixel-btn-ghost" : "pixel-btn-primary"}`}
                  disabled={
                    !complete || quest.claimed || claimMutation.isPending
                  }
                  onClick={() => claimMutation.mutate(quest.questKey)}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {quest.claimed ? "CLAIMED" : "CLAIM REWARD"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </ResponsivePanel>
  );
}
