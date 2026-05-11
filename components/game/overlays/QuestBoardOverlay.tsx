"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Coins, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["quests"],
    queryFn: () => apiFetch<QuestResponse>("/api/quests"),
    enabled: open
  });

  const claimMutation = useMutation({
    mutationFn: (questKey: string) =>
      apiFetch<QuestResponse>("/api/quests", {
        method: "POST",
        body: JSON.stringify({ questKey })
      }),
    onSuccess: async () => {
      toast.success("Daily quest reward claimed");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["quests"] }),
        queryClient.invalidateQueries({ queryKey: ["garden"] }),
        queryClient.invalidateQueries({ queryKey: ["me"] }),
        queryClient.invalidateQueries({ queryKey: ["activity"] })
      ]);
    },
    onError: (err) => {
      toast.error("Could not claim quest", {
        description: err instanceof Error ? err.message : "Try again later."
      });
    }
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
              <Card key={quest.questKey} className="bg-white/82">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-primary">
                        <ListChecks className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="font-black">{quest.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {Math.min(quest.progress, quest.target)}/{quest.target}
                        </div>
                      </div>
                    </div>
                    <Badge variant={complete ? "common" : "outline"} className="gap-1">
                      <Coins className="h-3.5 w-3.5" />
                      {quest.rewardGrow}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{quest.description}</p>
                  <Progress value={(Math.min(quest.progress, quest.target) / quest.target) * 100} />
                  <div className="text-xs font-semibold text-muted-foreground">
                    Expires {new Date(quest.expiresAt).toLocaleTimeString()}
                  </div>
                  <Button
                    className="w-full"
                    variant={quest.claimed ? "secondary" : "default"}
                    disabled={!complete || quest.claimed || claimMutation.isPending}
                    onClick={() => claimMutation.mutate(quest.questKey)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {quest.claimed ? "Claimed" : "Claim Reward"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </ResponsivePanel>
  );
}
