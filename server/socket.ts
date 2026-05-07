import http from "node:http";
import crypto from "node:crypto";
import { Server } from "socket.io";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/db/prisma";
import type { MovementPayload, OnlinePlayer, RealtimeRoom, TradeInvitePayload } from "@/lib/realtime/types";

const PORT = Number(process.env.SOCKET_PORT || 3003);
const NEARBY_TRADE_DISTANCE = Number(process.env.NEARBY_TRADE_DISTANCE || 64);
const TRADE_EXPIRY_SECONDS = 5 * 60;
const allowedOrigins = (process.env.SOCKET_CORS_ORIGIN || "http://localhost:3000,http://localhost:3001,http://localhost:3002")
  .split(",")
  .map((origin) => origin.trim());

const roomBounds: Record<string, { width: number; height: number }> = {
  town: { width: 1480, height: 1000 },
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
const tradeInviteRateLimit = new Map<string, number[]>();
const pendingTradeInvites = new Map<
  string,
  TradeInvitePayload & {
    fromSocketId: string;
  }
>();

function boundsForRoom(room: RealtimeRoom) {
  return room.startsWith("farm:") || room.startsWith("home:") ? roomBounds.farm : roomBounds[room] || roomBounds.town;
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
  for (const [socketId, player] of playersBySocket.entries()) {
    if (player.currentRoom === room) {
      io.to(socketId).emit("presence:update", {
        room,
        players: playersInRoom(room, socketId)
      });
    }
  }
}

function leaveCurrentRoom(socketId: string) {
  const player = playersBySocket.get(socketId);
  if (!player) {
    return;
  }

  for (const [inviteId, invite] of pendingTradeInvites.entries()) {
    if (invite.fromSocketId === socketId || invite.toUserId === player.userId) {
      pendingTradeInvites.delete(inviteId);
    }
  }
  playersBySocket.delete(socketId);
  lastMoveBySocket.delete(socketId);
  io.to(player.currentRoom).emit("player:left", {
    userId: player.userId,
    room: player.currentRoom
  });
  broadcastPresence(player.currentRoom);
}

function socketEntryForUser(userId: string, room: RealtimeRoom) {
  return Array.from(playersBySocket.entries()).find(
    ([, player]) => player.userId === userId && player.currentRoom === room
  );
}

function distanceBetween(a: OnlinePlayer, b: OnlinePlayer) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function canSendTradeInvite(socketId: string) {
  const now = Date.now();
  const recent = (tradeInviteRateLimit.get(socketId) || []).filter((time) => now - time < 30_000);
  if (recent.length >= 8) {
    tradeInviteRateLimit.set(socketId, recent);
    return false;
  }
  recent.push(now);
  tradeInviteRateLimit.set(socketId, recent);
  return true;
}

function emitInviteDeclined(invite: TradeInvitePayload, reason?: string) {
  const fromEntry = socketEntryForUser(invite.from.userId, invite.room);
  if (fromEntry) {
    io.to(fromEntry[0]).emit("trade:invite_declined", {
      inviteId: invite.inviteId,
      fromUserId: invite.from.userId,
      toUserId: invite.toUserId,
      room: invite.room,
      reason
    });
  }
}

async function createTradeSession(initiatorId: string, recipientId: string) {
  return prisma.$transaction(async (tx) => {
    const recipient = await tx.user.findUnique({
      where: { id: recipientId },
      select: { id: true, username: true }
    });
    if (!recipient || recipient.id === initiatorId) {
      throw new Error("Recipient not found.");
    }

    const trade = await tx.trade.create({
      data: {
        initiatorId,
        recipientId: recipient.id,
        status: "PENDING",
        expiresAt: new Date(Date.now() + TRADE_EXPIRY_SECONDS * 1000)
      },
      select: { id: true }
    });

    await tx.activityLog.create({
      data: {
        actorId: initiatorId,
        targetUserId: recipient.id,
        type: "TRADE_CREATED",
        message: `Created a trade with ${recipient.username}.`,
        metadata: { tradeId: trade.id }
      }
    });

    return trade;
  });
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

  const handleNearbyTradeInvite = ({ toUserId, room }: { toUserId: string; room: RealtimeRoom }) => {
    const from = playersBySocket.get(socket.id);
    if (!from || from.currentRoom !== room || from.userId === toUserId) {
      return;
    }
    if (!canSendTradeInvite(socket.id)) {
      socket.emit("trade:invite_declined", {
        inviteId: "",
        fromUserId: from.userId,
        toUserId,
        room,
        reason: "Too many trade invites. Slow down before sending another one."
      });
      return;
    }

    const targetEntry = socketEntryForUser(toUserId, room);
    if (!targetEntry) {
      socket.emit("trade:invite_declined", {
        inviteId: "",
        fromUserId: from.userId,
        toUserId,
        room,
        reason: "That player is no longer online in this area."
      });
      return;
    }

    const [, target] = targetEntry;
    if (distanceBetween(from, target) > NEARBY_TRADE_DISTANCE) {
      socket.emit("trade:invite_declined", {
        inviteId: "",
        fromUserId: from.userId,
        toUserId,
        room,
        reason: "Move closer before sending a trade invite."
      });
      return;
    }

    const invite: TradeInvitePayload = {
      inviteId: crypto.randomUUID(),
      from,
      toUserId,
      room,
      createdAt: Date.now()
    };

    pendingTradeInvites.set(invite.inviteId, { ...invite, fromSocketId: socket.id });
    io.to(targetEntry[0]).emit("trade:invite_received", invite);
  };

  socket.on("trade:invite_nearby", handleNearbyTradeInvite);
  socket.on("trade:invite", handleNearbyTradeInvite);

  socket.on("trade:accept_invite", async ({ inviteId }: { inviteId: string }) => {
    const invite = pendingTradeInvites.get(inviteId);
    const recipient = playersBySocket.get(socket.id);
    if (!invite || !recipient || recipient.userId !== invite.toUserId || recipient.currentRoom !== invite.room) {
      return;
    }

    const from = playersBySocket.get(invite.fromSocketId);
    if (!from || from.currentRoom !== invite.room) {
      pendingTradeInvites.delete(inviteId);
      socket.emit("trade:invite_declined", {
        inviteId,
        fromUserId: invite.from.userId,
        toUserId: invite.toUserId,
        room: invite.room,
        reason: "The inviter is no longer online in this area."
      });
      return;
    }

    if (Date.now() - invite.createdAt > 60_000 || distanceBetween(from, recipient) > NEARBY_TRADE_DISTANCE) {
      pendingTradeInvites.delete(inviteId);
      emitInviteDeclined(invite, "The trade invite expired or the players moved too far apart.");
      return;
    }

    try {
      const trade = await createTradeSession(from.userId, recipient.userId);
      pendingTradeInvites.delete(inviteId);
      const session = {
        inviteId,
        tradeId: trade.id,
        room: invite.room,
        initiator: {
          userId: from.userId,
          username: from.username,
          avatarUrl: from.avatarUrl
        },
        recipient: {
          userId: recipient.userId,
          username: recipient.username,
          avatarUrl: recipient.avatarUrl
        }
      };
      io.to(invite.fromSocketId).emit("trade:invite_accepted", session);
      io.to(invite.fromSocketId).emit("trade:session_created", session);
      socket.emit("trade:session_created", session);
    } catch (error) {
      pendingTradeInvites.delete(inviteId);
      emitInviteDeclined(invite, error instanceof Error ? error.message : "Could not create trade session.");
    }
  });

  socket.on("trade:decline_invite", ({ inviteId }: { inviteId: string }) => {
    const invite = pendingTradeInvites.get(inviteId);
    const recipient = playersBySocket.get(socket.id);
    if (!invite || !recipient || recipient.userId !== invite.toUserId) {
      return;
    }
    pendingTradeInvites.delete(inviteId);
    emitInviteDeclined(invite, `${recipient.username} declined the trade invite.`);
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
    tradeInviteRateLimit.delete(socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`GrowFi realtime socket server listening on http://localhost:${PORT}`);
});
