import { gameEventBus } from "@/lib/game/eventBus";
import type { OnlinePlayer, RealtimeRoom } from "@/lib/realtime/types";

export class PresenceSystem {
  private players: OnlinePlayer[] = [];
  private room?: RealtimeRoom;
  private cleanup: Array<() => void> = [];

  constructor() {
    this.cleanup.push(
      gameEventBus.on("roomPlayersUpdated", ({ room, players }) => {
        this.room = room as RealtimeRoom;
        this.players = players;
      })
    );
  }

  currentRoom() {
    return this.room;
  }

  onlinePlayers() {
    return this.players;
  }

  destroy() {
    this.cleanup.forEach((fn) => fn());
  }
}
