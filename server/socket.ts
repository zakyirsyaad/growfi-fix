import http from "node:http";
import crypto from "node:crypto";
import { Server } from "socket.io";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/db/prisma";
import type { MovementPayload, OnlinePlayer, RealtimeRoom, TradeInvitePayload } from "@/lib/realtime/types";

const PORT = Number(process.env.SOCKET_PORT || 3003);
const allowedOrigins = (process.env.SOCKET_CORS_ORIGIN || "http://localhost:3000,http://localhost:3001,http://localhost:3002")
  .split(",")
  .map((origin) => origin.trim());

const roomBounds: Record<string, { width: number; height: number }> = {
  town: { width: 1480, height: 1000 },
  seed_shop: { width: 1480, height: 1000 },
  marketplace: { width: 1480, height: 1000 },
  trade_area: { width: 1480, height: 1000 },
  farm: { width: 1400, height: 960 }
};

const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  }
});

const playersBySocket = new Map<string, OnlinePlayer>();
const lastMoveBySocket = new Map<string, { x: number; y: number; at: number }>();
const chatRateLimit = new Map<string, number[]>();

function boundsForRoom(room: RealtimeRoom) {
  return room.startsWith("farm:") ? roomBounds.farm : roomBounds[room] || roomBounds.town;
}

function clampToRoom(room: RealtimeRoom, x: number, y: number) {
  const bounds = boundsForRoom(room);
  return {
    x: Math.max(0, Math.min(bounds.width, x)),
    y: Math.max(0, Math.min(bounds.height, y))
  };
}

function playersInRoom(room: RealtimeRoom, exceptSocketId?: string) {
  return Array.from(playersBySocket.entries())
    .filter(([socketId, player]) => player.currentRoom === room && socketId !== exceptSocketId)
    .map(([, player]) => player);
}

function broadcastPresence(room: RealtimeRoom) {
  io.to(room).emit("presence:update", {
    room,
    players: playersInRoom(room)
  });
}

function leaveCurrentRoom(socketId: string) {
  const player = playersBySocket.get(socketId);
  if (!player) {
    return;
  }

  playersBySocket.delete(socketId);
  lastMoveBySocket.delete(socketId);
  io.to(player.currentRoom).emit("player:left", {
    userId: player.userId,
    room: player.currentRoom
  });
  broadcastPresence(player.currentRoom);
}

async function authenticateSocket(socket: Parameters<typeof io.use>[0] extends (socket: infer S, next: any) => any ? S : never) {
  const token = await getToken({
    req: socket.request as any,
    secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET
  });

  const userId = token?.userId ? String(token.userId) : "";
  if (!userId) {
    throw new Error("Unauthenticated socket connection.");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, avatarUrl: true, walletAddress: true }
  });

  if (!user) {
    throw new Error("Socket user not found.");
  }

  socket.data.user = user;
}

io.use(async (socket, next) => {
  try {
    await authenticateSocket(socket);
    next();
  } catch (error) {
    next(error instanceof Error ? error : new Error("Socket authentication failed."));
  }
});

io.on("connection", (socket) => {
  socket.on("player:join_room", ({ room, x, y }: { room: RealtimeRoom; x: number; y: number }) => {
    leaveCurrentRoom(socket.id);
    socket.join(room);

    const position = clampToRoom(room, x, y);
    const user = socket.data.user as {
      id: string;
      username: string;
      avatarUrl?: string | null;
      walletAddress?: string | null;
    };
    const player: OnlinePlayer = {
      userId: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      walletAddress: user.walletAddress,
      currentRoom: room,
      x: position.x,
      y: position.y,
      direction: "idle",
      animationState: "idle",
      lastSeenAt: Date.now()
    };

    playersBySocket.set(socket.id, player);
    lastMoveBySocket.set(socket.id, { x: player.x, y: player.y, at: Date.now() });
    socket.emit("room:players", { room, players: playersInRoom(room, socket.id) });
    socket.to(room).emit("player:joined", player);
    broadcastPresence(room);
  });

  socket.on("player:leave_room", ({ room }: { room: RealtimeRoom }) => {
    const player = playersBySocket.get(socket.id);
    if (player?.currentRoom === room) {
      socket.leave(room);
      leaveCurrentRoom(socket.id);
    }
  });

  socket.on("player:move", (payload: MovementPayload) => {
    const player = playersBySocket.get(socket.id);
    if (!player || player.currentRoom !== payload.room) {
      return;
    }

    const now = Date.now();
    const last = lastMoveBySocket.get(socket.id) || { x: player.x, y: player.y, at: now };
    if (now - last.at < 45) {
      return;
    }

    const target = clampToRoom(payload.room, payload.x, payload.y);
    const elapsedSeconds = Math.max(0.05, (now - last.at) / 1000);
    const distance = Math.hypot(target.x - last.x, target.y - last.y);
    const maxDistance = 360 * elapsedSeconds + 80;
    if (distance > maxDistance) {
      return;
    }

    const updated: OnlinePlayer = {
      ...player,
      x: target.x,
      y: target.y,
      direction: payload.direction,
      animationState: payload.animationState,
      lastSeenAt: now
    };
    playersBySocket.set(socket.id, updated);
    lastMoveBySocket.set(socket.id, { x: target.x, y: target.y, at: now });
    socket.to(payload.room).emit("player:moved", updated);
  });

  socket.on("player:stop", (payload: MovementPayload) => {
    const player = playersBySocket.get(socket.id);
    if (!player || player.currentRoom !== payload.room) {
      return;
    }

    const target = clampToRoom(payload.room, payload.x, payload.y);
    const updated: OnlinePlayer = {
      ...player,
      x: target.x,
      y: target.y,
      direction: payload.direction,
      animationState: "idle",
      lastSeenAt: Date.now()
    };
    playersBySocket.set(socket.id, updated);
    lastMoveBySocket.set(socket.id, { x: target.x, y: target.y, at: Date.now() });
    socket.to(payload.room).emit("player:stopped", updated);
  });

  socket.on("trade:invite", ({ toUserId, room }: { toUserId: string; room: RealtimeRoom }) => {
    const from = playersBySocket.get(socket.id);
    if (!from || from.currentRoom !== room || from.userId === toUserId) {
      return;
    }

    const invite: TradeInvitePayload = {
      inviteId: crypto.randomUUID(),
      from,
      toUserId,
      room,
      createdAt: Date.now()
    };

    for (const [targetSocketId, player] of playersBySocket.entries()) {
      if (player.userId === toUserId && player.currentRoom === room) {
        io.to(targetSocketId).emit("trade:invite_received", invite);
      }
    }
  });

  socket.on("player:interact", ({ targetUserId, room }: { targetUserId: string; room: RealtimeRoom }) => {
    const from = playersBySocket.get(socket.id);
    if (!from || from.currentRoom !== room || from.userId === targetUserId) {
      return;
    }
  });

  socket.on("chat:message", ({ room, message }: { room: RealtimeRoom; message: string }) => {
    const from = playersBySocket.get(socket.id);
    if (!from || from.currentRoom !== room) {
      return;
    }

    const now = Date.now();
    const recent = (chatRateLimit.get(socket.id) || []).filter((time) => now - time < 10_000);
    if (recent.length >= 6 || message.trim().length === 0 || message.length > 180) {
      return;
    }
    recent.push(now);
    chatRateLimit.set(socket.id, recent);

    io.to(room).emit("chat:message", {
      id: crypto.randomUUID(),
      room,
      from,
      message: message.trim(),
      createdAt: now
    });
  });

  socket.on("disconnect", () => {
    leaveCurrentRoom(socket.id);
    chatRateLimit.delete(socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`GrowFi realtime socket server listening on http://localhost:${PORT}`);
});
