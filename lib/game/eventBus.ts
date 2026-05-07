import type {
  ChatMessagePayload,
  OnlinePlayer,
  TradeInviteDeclinedPayload,
  TradeInvitePayload,
  TradeSessionCreatedPayload
} from "@/lib/realtime/types";

export type GameArea = "Home Farm" | "Town Social Hub" | "Other User Farm";

export type GameInteractableType =
  | "plot"
  | "shop"
  | "marketplace"
  | "trade"
  | "wallet"
  | "profile"
  | "leaderboard"
  | "communityBoard"
  | "eventBoard"
  | "visitFarm"
  | "chatBoard"
  | "mailbox"
  | "farmBoard"
  | "storageChest"
  | "waterWell"
  | "questBoard"
  | "cosmeticShop"
  | "socialTradePlaza"
  | "scarecrow"
  | "pond"
  | "petArea"
  | "remotePlayer"
  | "homeExit"
  | "townExit";

export type GameOverlayKey =
  | "inventory"
  | "seedSelect"
  | "seedShop"
  | "marketplace"
  | "trade"
  | "wallet"
  | "profile"
  | "activityLog"
  | "visitFarm"
  | "leaderboard"
  | "communityBoard"
  | "eventBoard"
  | "localChat"
  | "profilePreview"
  | "farmUpgrade"
  | "questBoard"
  | "onlinePlayers"
  | "playerInteraction";

export type GameBusEvents = {
  openOverlay: { overlay: GameOverlayKey; payload?: unknown };
  closeOverlay: { overlay?: GameOverlayKey };
  interactionPrompt: {
    visible: boolean;
    label?: string;
    targetId?: string;
    targetType?: GameInteractableType;
  };
  interact: undefined;
  selectPlot: { plotId: string; visitorMode?: boolean };
  gardenStateUpdated: unknown;
  refreshFarmState: undefined;
  refillWater: undefined;
  visitorFarmLoaded: unknown;
  returnHome: undefined;
  areaChanged: { area: GameArea; visitorMode?: boolean; ownerName?: string };
  roomPlayersUpdated: { players: OnlinePlayer[]; room: string };
  remotePlayerMoved: { player: OnlinePlayer; room: string };
  remotePlayerStopped: { player: OnlinePlayer; room: string };
  tradeInviteReceived: TradeInvitePayload;
  tradeInviteAccepted: TradeSessionCreatedPayload;
  tradeInviteDeclined: TradeInviteDeclinedPayload;
  tradeSessionCreated: TradeSessionCreatedPayload;
  localChatMessage: ChatMessagePayload;
  socketReady: { connected: boolean };
  joystickMove: { x: number; y: number };
  joystickEnd: undefined;
  actionToast: { title: string; description?: string; variant?: "success" | "error" };
};

type Listener<T> = (payload: T) => void;

class GrowFiEventBus {
  private listeners = new Map<keyof GameBusEvents, Set<Listener<any>>>();

  on<K extends keyof GameBusEvents>(event: K, listener: Listener<GameBusEvents[K]>) {
    const set = this.listeners.get(event) || new Set<Listener<any>>();
    set.add(listener);
    this.listeners.set(event, set);
    return () => this.off(event, listener);
  }

  off<K extends keyof GameBusEvents>(event: K, listener: Listener<GameBusEvents[K]>) {
    this.listeners.get(event)?.delete(listener);
  }

  emit<K extends keyof GameBusEvents>(
    event: K,
    ...payload: GameBusEvents[K] extends undefined ? [] : [GameBusEvents[K]]
  ) {
    const value = payload[0] as GameBusEvents[K];
    this.listeners.get(event)?.forEach((listener) => listener(value));
  }
}

export const gameEventBus = new GrowFiEventBus();
