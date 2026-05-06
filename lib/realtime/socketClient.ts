"use client";

import { io, type Socket } from "socket.io-client";
import { gameEventBus } from "@/lib/game/eventBus";
import type { ChatMessagePayload, MovementPayload, OnlinePlayer, RealtimeRoom, TradeInvitePayload } from "@/lib/realtime/types";

type ServerToClientEvents = {
  "room:players": (payload: { room: RealtimeRoom; players: OnlinePlayer[] }) => void;
  "player:joined": (player: OnlinePlayer) => void;
  "player:left": (payload: { userId: string; room: RealtimeRoom }) => void;
  "player:moved": (player: OnlinePlayer) => void;
  "player:stopped": (player: OnlinePlayer) => void;
  "trade:invite_received": (invite: TradeInvitePayload) => void;
  "chat:message": (message: ChatMessagePayload) => void;
  "presence:update": (payload: { room: RealtimeRoom; players: OnlinePlayer[] }) => void;
};

type ClientToServerEvents = {
  "player:join_room": (payload: { room: RealtimeRoom; x: number; y: number }) => void;
  "player:leave_room": (payload: { room: RealtimeRoom }) => void;
  "player:move": (payload: MovementPayload) => void;
  "player:stop": (payload: MovementPayload) => void;
  "player:interact": (payload: { targetUserId: string; room: RealtimeRoom }) => void;
  "trade:invite": (payload: { toUserId: string; room: RealtimeRoom }) => void;
  "chat:message": (payload: { room: RealtimeRoom; message: string }) => void;
};

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
let currentPlayers: OnlinePlayer[] = [];
let currentRoom: RealtimeRoom | null = null;

function broadcastPlayers(room: RealtimeRoom, players = currentPlayers) {
  currentPlayers = players;
  currentRoom = room;
  gameEventBus.emit("roomPlayersUpdated", { room, players });
}

export function getRealtimeSocket() {
  if (socket) {
    return socket;
  }

  socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3003", {
    withCredentials: true,
    transports: ["websocket", "polling"],
    autoConnect: true
  });

  socket.on("connect", () => {
    gameEventBus.emit("socketReady", { connected: true });
  });
  socket.on("disconnect", () => {
    gameEventBus.emit("socketReady", { connected: false });
  });
  socket.on("room:players", ({ room, players }) => broadcastPlayers(room, players));
  socket.on("presence:update", ({ room, players }) => broadcastPlayers(room, players));
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
    broadcastPlayers(room, currentPlayers.filter((item) => item.userId !== userId));
  });
  socket.on("player:moved", (player) => {
    if (currentRoom !== player.currentRoom) {
      return;
    }
    broadcastPlayers(player.currentRoom, [
      ...currentPlayers.filter((item) => item.userId !== player.userId),
      player
    ]);
  });
  socket.on("player:stopped", (player) => {
    if (currentRoom !== player.currentRoom) {
      return;
    }
    broadcastPlayers(player.currentRoom, [
      ...currentPlayers.filter((item) => item.userId !== player.userId),
      player
    ]);
  });
  socket.on("trade:invite_received", (invite) => {
    gameEventBus.emit("tradeInviteReceived", invite);
  });

  return socket;
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

  getRealtimeSocket().emit("trade:invite", { toUserId, room: targetRoom });
}
