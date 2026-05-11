"use client";

import { io, type Socket } from "socket.io-client";
import { gameEventBus } from "@/lib/game/eventBus";
import type {
  ChatMessagePayload,
  GlobalChatMessagePayload,
  MovementPayload,
  OnlinePlayer,
  RealtimeRoom,
  TradeInviteDeclinedPayload,
  TradeInvitePayload,
  TradeSessionCreatedPayload
} from "@/lib/realtime/types";

type ServerToClientEvents = {
  "room:players": (payload: { room: RealtimeRoom; players: OnlinePlayer[] }) => void;
  "player:joined": (player: OnlinePlayer) => void;
  "player:left": (payload: { userId: string; room: RealtimeRoom }) => void;
  "player:moved": (player: OnlinePlayer) => void;
  "player:stopped": (player: OnlinePlayer) => void;
  "trade:invite_received": (invite: TradeInvitePayload) => void;
  "trade:invite_accepted": (payload: TradeSessionCreatedPayload) => void;
  "trade:invite_declined": (payload: TradeInviteDeclinedPayload) => void;
  "trade:session_created": (payload: TradeSessionCreatedPayload) => void;
  "chat:message": (message: ChatMessagePayload) => void;
  "chat:global:history": (payload: { messages: GlobalChatMessagePayload[] }) => void;
  "chat:global:message": (message: GlobalChatMessagePayload) => void;
  "chat:global:error": (payload: { message: string }) => void;
  "presence:update": (payload: { room: RealtimeRoom; players: OnlinePlayer[] }) => void;
};

type ClientToServerEvents = {
  "player:join_room": (payload: { room: RealtimeRoom; x: number; y: number }) => void;
  "player:leave_room": (payload: { room: RealtimeRoom }) => void;
  "player:move": (payload: MovementPayload) => void;
  "player:stop": (payload: MovementPayload) => void;
  "player:interact": (payload: { targetUserId: string; room: RealtimeRoom }) => void;
  "trade:invite": (payload: { toUserId: string; room: RealtimeRoom }) => void;
  "trade:invite_nearby": (payload: { toUserId: string; room: RealtimeRoom }) => void;
  "trade:accept_invite": (payload: { inviteId: string }) => void;
  "trade:decline_invite": (payload: { inviteId: string }) => void;
  "chat:message": (payload: { room: RealtimeRoom; message: string }) => void;
  "chat:global:join": () => void;
  "chat:global:message": (payload: { message: string }) => void;
};

export type RealtimeConnectionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
let currentPlayers: OnlinePlayer[] = [];
let currentRoom: RealtimeRoom | null = null;
let realtimeStatus: {
  connected: boolean;
  status: RealtimeConnectionStatus;
  message?: string;
  url: string;
} = {
  connected: false,
  status: "disconnected",
  url: ""
};

function resolveRealtimeUrl() {
  const explicit =
    process.env.NEXT_PUBLIC_REALTIME_URL || process.env.NEXT_PUBLIC_SOCKET_URL;
  if (explicit) {
    return explicit;
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:3000";
}

function emitSocketStatus(
  status: RealtimeConnectionStatus,
  message?: string
) {
  realtimeStatus = {
    connected: status === "connected",
    status,
    message,
    url: realtimeStatus.url || resolveRealtimeUrl()
  };
  gameEventBus.emit("socketReady", realtimeStatus);
  if (process.env.NODE_ENV === "development") {
    console.debug("[GrowFi] realtime socket", realtimeStatus);
  }
}

function broadcastPlayers(room: RealtimeRoom, players = currentPlayers) {
  currentPlayers = players;
  currentRoom = room;
  gameEventBus.emit("roomPlayersUpdated", { room, players });
}

function updateCachedPlayer(player: OnlinePlayer) {
  currentPlayers = [
    ...currentPlayers.filter((item) => item.userId !== player.userId),
    player
  ];
}

export function getRealtimeSocket() {
  if (socket) {
    return socket;
  }

  const url = resolveRealtimeUrl();
  realtimeStatus = { ...realtimeStatus, url };
  emitSocketStatus("connecting", `Connecting to ${url}`);

  socket = io(url, {
    withCredentials: true,
    transports: ["websocket", "polling"],
    autoConnect: true
  });

  socket.on("connect", () => {
    emitSocketStatus("connected");
    joinGlobalChat();
  });
  socket.on("connect_error", (error) => {
    emitSocketStatus("error", error.message);
  });
  socket.io.on("reconnect_attempt", (attempt) => {
    emitSocketStatus("reconnecting", `Reconnect attempt ${attempt}`);
  });
  socket.io.on("reconnect", () => {
    emitSocketStatus("connected");
  });
  socket.on("disconnect", (reason) => {
    emitSocketStatus("disconnected", reason);
  });
  socket.on("room:players", ({ room, players }) => broadcastPlayers(room, players));
  socket.on("presence:update", ({ room, players }) => {
    if (!currentRoom || currentRoom === room) {
      broadcastPlayers(room, players);
    }
  });
  socket.on("player:joined", (player) => {
    if (currentRoom !== player.currentRoom) {
      return;
    }
    broadcastPlayers(player.currentRoom, [
      ...currentPlayers.filter((item) => item.userId !== player.userId),
      player
    ]);
    gameEventBus.emit("actionToast", {
      title: `${player.username} joined`,
      description: "Another farmer entered this area."
    });
  });
  socket.on("player:left", ({ userId, room }) => {
    if (currentRoom !== room) {
      return;
    }
    broadcastPlayers(room, currentPlayers.filter((item) => item.userId !== userId));
  });
  socket.on("player:moved", (player) => {
    if (currentRoom !== player.currentRoom) {
      return;
    }
    updateCachedPlayer(player);
    gameEventBus.emit("remotePlayerMoved", { room: player.currentRoom, player });
  });
  socket.on("player:stopped", (player) => {
    if (currentRoom !== player.currentRoom) {
      return;
    }
    updateCachedPlayer(player);
    gameEventBus.emit("remotePlayerStopped", { room: player.currentRoom, player });
  });
  socket.on("trade:invite_received", (invite) => {
    gameEventBus.emit("tradeInviteReceived", invite);
  });
  socket.on("trade:invite_accepted", (payload) => {
    gameEventBus.emit("tradeInviteAccepted", payload);
  });
  socket.on("trade:invite_declined", (payload) => {
    gameEventBus.emit("tradeInviteDeclined", payload);
  });
  socket.on("trade:session_created", (payload) => {
    gameEventBus.emit("tradeSessionCreated", payload);
  });
  socket.on("chat:message", (message) => {
    gameEventBus.emit("localChatMessage", message);
  });
  socket.on("chat:global:history", (payload) => {
    gameEventBus.emit("globalChatHistory", payload);
  });
  socket.on("chat:global:message", (message) => {
    gameEventBus.emit("globalChatMessage", message);
  });
  socket.on("chat:global:error", (payload) => {
    gameEventBus.emit("globalChatError", payload);
  });

  return socket;
}

export function getRealtimeSocketStatus() {
  return realtimeStatus;
}

export function joinRealtimeRoom(room: RealtimeRoom, x: number, y: number) {
  getRealtimeSocket().emit("player:join_room", { room, x, y });
}

export function leaveRealtimeRoom(room: RealtimeRoom) {
  getRealtimeSocket().emit("player:leave_room", { room });
}

export function sendMovement(payload: MovementPayload) {
  getRealtimeSocket().emit("player:move", payload);
}

export function sendStop(payload: MovementPayload) {
  getRealtimeSocket().emit("player:stop", payload);
}

export function sendTradeInvite(toUserId: string, room?: RealtimeRoom | string | null) {
  const targetRoom = (room || currentRoom) as RealtimeRoom | null;
  if (!targetRoom) {
    return;
  }

  getRealtimeSocket().emit("trade:invite_nearby", { toUserId, room: targetRoom });
}

export function acceptTradeInvite(inviteId: string) {
  getRealtimeSocket().emit("trade:accept_invite", { inviteId });
}

export function declineTradeInvite(inviteId: string) {
  getRealtimeSocket().emit("trade:decline_invite", { inviteId });
}

export function sendLocalChatMessage(message: string, room?: RealtimeRoom | string | null) {
  const targetRoom = (room || currentRoom) as RealtimeRoom | null;
  if (!targetRoom) {
    return;
  }

  getRealtimeSocket().emit("chat:message", { room: targetRoom, message });
}

export function joinGlobalChat() {
  getRealtimeSocket().emit("chat:global:join");
}

export function sendGlobalChatMessage(message: string) {
  getRealtimeSocket().emit("chat:global:message", { message });
}
