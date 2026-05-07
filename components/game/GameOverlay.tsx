"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GameHUD } from "@/components/game/GameHUD";
import { InteractionPrompt } from "@/components/game/InteractionPrompt";
import { MobileControls } from "@/components/game/MobileControls";
import { ActivityLogOverlay } from "@/components/game/overlays/ActivityLogOverlay";
import { CommunityBoardOverlay } from "@/components/game/overlays/CommunityBoardOverlay";
import { EventBoardOverlay } from "@/components/game/overlays/EventBoardOverlay";
import { InventoryOverlay } from "@/components/game/overlays/InventoryOverlay";
import { IncomingTradeInviteDialog } from "@/components/game/overlays/IncomingTradeInviteDialog";
import { LeaderboardOverlay } from "@/components/game/overlays/LeaderboardOverlay";
import { LocalChatOverlay } from "@/components/game/overlays/LocalChatOverlay";
import { MarketplaceOverlay } from "@/components/game/overlays/MarketplaceOverlay";
import { ProfileOverlay } from "@/components/game/overlays/ProfileOverlay";
import { ProfilePreviewDialog } from "@/components/game/overlays/ProfilePreviewDialog";
import { SeedSelectModal } from "@/components/game/overlays/SeedSelectModal";
import { SeedShopOverlay } from "@/components/game/overlays/SeedShopOverlay";
import { TradeOverlay } from "@/components/game/overlays/TradeOverlay";
import { VisitFarmOverlay } from "@/components/game/overlays/VisitFarmOverlay";
import { WalletOverlay } from "@/components/game/overlays/WalletOverlay";
import { FarmUpgradeOverlay } from "@/components/game/overlays/FarmUpgradeOverlay";
import { OnlinePlayersOverlay } from "@/components/game/overlays/OnlinePlayersOverlay";
import { PlayerInteractionOverlay } from "@/components/game/overlays/PlayerInteractionOverlay";
import { QuestBoardOverlay } from "@/components/game/overlays/QuestBoardOverlay";
import { gameEventBus, type GameArea, type GameOverlayKey } from "@/lib/game/eventBus";
import { apiFetch } from "@/lib/utils/fetcher";
import type { ChatMessagePayload, OnlinePlayer, TradeInvitePayload } from "@/lib/realtime/types";
import type { GardenResponse } from "@/types/game-data";

type OverlayState = Partial<Record<GameOverlayKey, boolean>>;

function samePrompt(
  current: { visible: boolean; label?: string },
  next: { visible: boolean; label?: string }
) {
  return current.visible === next.visible && current.label === next.label;
}

function sameOnlinePlayers(current: OnlinePlayer[], next: OnlinePlayer[]) {
  if (current.length !== next.length) {
    return false;
  }

  return current.every((player, index) => {
    const candidate = next[index];
    return (
      candidate &&
      player.userId === candidate.userId &&
      player.username === candidate.username &&
      player.currentRoom === candidate.currentRoom
    );
  });
}

export function GameOverlay({
  garden,
  shopEndsAt
}: {
  garden?: GardenResponse;
  shopEndsAt?: string;
}) {
  const queryClient = useQueryClient();
  const [overlays, setOverlays] = useState<OverlayState>({});
  const [payloads, setPayloads] = useState<Partial<Record<GameOverlayKey, unknown>>>({});
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [selectedPlotVisitorMode, setSelectedPlotVisitorMode] = useState(false);
  const [prompt, setPrompt] = useState<{ visible: boolean; label?: string }>({ visible: false });
  const [area, setArea] = useState<GameArea>("Home Farm");
  const [ownerName, setOwnerName] = useState<string | undefined>();
  const [visitorMode, setVisitorMode] = useState(false);
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);
  const [currentRoom, setCurrentRoom] = useState("home:unknown");
  const [incomingInvite, setIncomingInvite] = useState<TradeInvitePayload | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessagePayload[]>([]);

  const refreshGameQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["garden"] }),
      queryClient.invalidateQueries({ queryKey: ["inventory"] }),
      queryClient.invalidateQueries({ queryKey: ["me"] }),
      queryClient.invalidateQueries({ queryKey: ["quests"] })
    ]);
  };

  const refillWaterMutation = useMutation({
    mutationFn: () => apiFetch("/api/garden/refill-water", { method: "POST" }),
    onSuccess: async () => {
      toast.success("Watering can refilled");
      await refreshGameQueries();
    },
    onError: (err) => {
      toast.error("Could not refill water", {
        description: err instanceof Error ? err.message : "Try again at the well."
      });
    }
  });

  useEffect(() => {
    return gameEventBus.on("openOverlay", ({ overlay, payload }) => {
      setPayloads((current) => ({ ...current, [overlay]: payload }));
      setOverlays((current) => ({ ...current, [overlay]: true }));
    });
  }, []);

  useEffect(() => {
    return gameEventBus.on("closeOverlay", ({ overlay }) => {
      if (overlay) {
        setOverlays((current) => ({ ...current, [overlay]: false }));
      } else {
        setOverlays({});
      }
    });
  }, []);

  useEffect(() => {
    return gameEventBus.on("selectPlot", ({ plotId, visitorMode: isVisitor }) => {
      setSelectedPlotId(plotId);
      setSelectedPlotVisitorMode(!!isVisitor);
      setOverlays((current) => ({ ...current, seedSelect: true }));
    });
  }, []);

  useEffect(() => {
    return gameEventBus.on("interactionPrompt", ({ visible, label }) => {
      setPrompt((current) => {
        const next = { visible, label };
        return samePrompt(current, next) ? current : next;
      });
    });
  }, []);

  useEffect(() => {
    return gameEventBus.on("areaChanged", ({ area: nextArea, ownerName: nextOwner, visitorMode: isVisitor }) => {
      setArea((current) => (current === nextArea ? current : nextArea));
      setOwnerName((current) => (current === nextOwner ? current : nextOwner));
      setVisitorMode((current) => (current === !!isVisitor ? current : !!isVisitor));
    });
  }, []);

  useEffect(() => {
    return gameEventBus.on("actionToast", ({ title, description, variant }) => {
      if (variant === "error") {
        toast.error(title, { description });
      } else {
        toast(title, { description });
      }
    });
  }, []);

  useEffect(() => {
    return gameEventBus.on("refreshFarmState", () => {
      refreshGameQueries();
    });
  }, []);

  useEffect(() => {
    return gameEventBus.on("refillWater", () => {
      if (!refillWaterMutation.isPending) {
        refillWaterMutation.mutate();
      }
    });
  }, [refillWaterMutation]);

  useEffect(() => {
    return gameEventBus.on("roomPlayersUpdated", ({ players, room }) => {
      setOnlinePlayers((current) => (sameOnlinePlayers(current, players) ? current : players));
      setCurrentRoom((current) => (current === room ? current : room));
    });
  }, []);

  useEffect(() => {
    return gameEventBus.on("tradeInviteReceived", (invite) => {
      setIncomingInvite(invite);
    });
  }, []);

  useEffect(() => {
    return gameEventBus.on("tradeSessionCreated", (session) => {
      const other = session.initiator.userId === garden?.user.id ? session.recipient : session.initiator;
      setPayloads((current) => ({
        ...current,
        trade: {
          tradeId: session.tradeId,
          recipientId: other.userId,
          recipientUsername: other.username
        }
      }));
      setOverlays((current) => ({ ...current, trade: true }));
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      toast.success(`Trade opened with ${other.username}`);
    });
  }, [garden?.user.id, queryClient]);

  useEffect(() => {
    return gameEventBus.on("tradeInviteAccepted", (session) => {
      toast.success(`${session.recipient.username} accepted your trade invite`);
    });
  }, []);

  useEffect(() => {
    return gameEventBus.on("tradeInviteDeclined", (payload) => {
      toast.error("Trade invite declined", {
        description: payload.reason || "The other farmer declined."
      });
    });
  }, []);

  useEffect(() => {
    return gameEventBus.on("localChatMessage", (message) => {
      setChatMessages((current) => [...current.slice(-99), message]);
    });
  }, []);

  const setOverlay = (overlay: GameOverlayKey, open: boolean) => {
    setOverlays((current) => ({ ...current, [overlay]: open }));
  };

  const shared = useMemo(
    () => ({
      garden,
      area,
      ownerName,
      visitorMode,
      shopEndsAt
    }),
    [area, garden, ownerName, shopEndsAt, visitorMode]
  );

  return (
    <>
      <GameHUD {...shared} />
      <InteractionPrompt visible={prompt.visible} label={prompt.label} />
      <MobileControls />

      <SeedSelectModal
        open={!!overlays.seedSelect}
        onOpenChange={(open) => setOverlay("seedSelect", open)}
        garden={garden}
        plotId={selectedPlotId}
        visitorMode={selectedPlotVisitorMode}
      />
      <InventoryOverlay open={!!overlays.inventory} onOpenChange={(open) => setOverlay("inventory", open)} />
      <SeedShopOverlay open={!!overlays.seedShop} onOpenChange={(open) => setOverlay("seedShop", open)} />
      <MarketplaceOverlay
        open={!!overlays.marketplace}
        onOpenChange={(open) => setOverlay("marketplace", open)}
        payload={payloads.marketplace}
      />
      <TradeOverlay
        open={!!overlays.trade}
        onOpenChange={(open) => setOverlay("trade", open)}
        payload={payloads.trade}
        onlinePlayers={onlinePlayers}
      />
      <WalletOverlay open={!!overlays.wallet} onOpenChange={(open) => setOverlay("wallet", open)} />
      <ProfileOverlay open={!!overlays.profile} onOpenChange={(open) => setOverlay("profile", open)} />
      <ActivityLogOverlay open={!!overlays.activityLog} onOpenChange={(open) => setOverlay("activityLog", open)} />
      <VisitFarmOverlay
        open={!!overlays.visitFarm}
        onOpenChange={(open) => setOverlay("visitFarm", open)}
        onlinePlayers={onlinePlayers}
      />
      <LeaderboardOverlay open={!!overlays.leaderboard} onOpenChange={(open) => setOverlay("leaderboard", open)} />
      <CommunityBoardOverlay open={!!overlays.communityBoard} onOpenChange={(open) => setOverlay("communityBoard", open)} />
      <EventBoardOverlay open={!!overlays.eventBoard} onOpenChange={(open) => setOverlay("eventBoard", open)} />
      <LocalChatOverlay
        open={!!overlays.localChat}
        onOpenChange={(open) => setOverlay("localChat", open)}
        room={currentRoom}
        messages={chatMessages}
      />
      <FarmUpgradeOverlay
        open={!!overlays.farmUpgrade}
        onOpenChange={(open) => setOverlay("farmUpgrade", open)}
        garden={garden}
      />
      <QuestBoardOverlay open={!!overlays.questBoard} onOpenChange={(open) => setOverlay("questBoard", open)} />
      <OnlinePlayersOverlay
        open={!!overlays.onlinePlayers}
        onOpenChange={(open) => setOverlay("onlinePlayers", open)}
        players={onlinePlayers}
        room={currentRoom}
      />
      <PlayerInteractionOverlay
        open={!!overlays.playerInteraction}
        onOpenChange={(open) => setOverlay("playerInteraction", open)}
        player={payloads.playerInteraction as OnlinePlayer | undefined}
      />
      <ProfilePreviewDialog
        open={!!overlays.profilePreview}
        onOpenChange={(open) => setOverlay("profilePreview", open)}
        player={payloads.profilePreview as OnlinePlayer | undefined}
      />
      <IncomingTradeInviteDialog invite={incomingInvite} onClose={() => setIncomingInvite(null)} />
    </>
  );
}
