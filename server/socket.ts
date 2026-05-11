import http from "node:http";
import crypto from "node:crypto";
import { Server, type Socket } from "socket.io";
import { loadEnvConfig } from "@next/env";
import { decode, getToken } from "next-auth/jwt";
import { prisma } from "@/lib/db/prisma";
import { GAME_BALANCE } from "@/lib/game/balance";
import type { GlobalChatMessagePayload, MovementPayload, OnlinePlayer, RealtimeRoom, TradeInvitePayload } from "@/lib/realtime/types";

loadEnvConfig(process.cwd());

const PORT = Number(process.env.REALTIME_PORT || process.env.SOCKET_PORT || 3000);
const NEARBY_TRADE_DISTANCE = Number(process.env.NEARBY_TRADE_DISTANCE || 64);
const TRADE_EXPIRY_SECONDS = GAME_BALANCE.trade.expirySeconds;
const TRADE_INVITE_EXPIRY_SECONDS = GAME_BALANCE.trade.inviteExpirySeconds;
const allowedOrigins = (
  process.env.REALTIME_CORS_ORIGIN ||
  process.env.SOCKET_CORS_ORIGIN ||
  "http://localhost:3000,http://localhost:3001,http://localhost:3002"
)
  .split(",")
  .map((origin) => origin.trim());

const roomBounds: Record<string, { width: number; height: number }> = {
  town: { width: 1480, height: 1000 },
  farm: { width: 1400, height: 960 }
};

let io: Server;

const playersBySocket = new Map<string, OnlinePlayer>();
const lastMoveBySocket = new Map<string, { x: number; y: number; at: number }>();
const chatRateLimit = new Map<string, number[]>();
const globalChatRateLimit = new Map<string, number[]>();
const tradeInviteRateLimit = new Map<string, number[]>();
const globalChatHistory: GlobalChatMessagePayload[] = [];
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
  const socket = io.sockets.sockets.get(socketId);
  socket?.leave(player.currentRoom);

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
  if (process.env.NODE_ENV === "development") {
    console.debug("[GrowFi realtime] player left room", {
      socketId,
      userId: player.userId,
      room: player.currentRoom,
      playerCount: playersInRoom(player.currentRoom).length
    });
  }
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

function sanitizeChatMessage(message: string) {
  return message
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function canSendGlobalChat(userId: string) {
  const now = Date.now();
  const recent = (globalChatRateLimit.get(userId) || []).filter(
    (time) => now - time < 10_000
  );
  if (recent.length >= 5) {
    globalChatRateLimit.set(userId, recent);
    return false;
  }
  recent.push(now);
  globalChatRateLimit.set(userId, recent);
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

type NextAuthTokenRequest = Parameters<typeof getToken>[0]["req"];

function parseCookieHeader(header: string | string[] | undefined) {
  const source = Array.isArray(header) ? header.join("; ") : header || "";
  return source.split(";").reduce<Record<string, string>>((cookies, entry) => {
    const [rawName, ...rawValue] = entry.trim().split("=");
    if (!rawName || rawValue.length === 0) {
      return cookies;
    }
    cookies[rawName] = decodeURIComponent(rawValue.join("="));
    return cookies;
  }, {});
}

async function authenticateSocket(socket: Socket) {
  const request = socket.request as NextAuthTokenRequest & {
    cookies?: Record<string, string>;
  };
  request.cookies = {
    ...parseCookieHeader(socket.request.headers.cookie),
    ...(request.cookies || {}),
  };
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET or AUTH_SECRET is required for socket authentication.");
  }
  let token = await getToken({
    req: request,
    secret
  })
    || await getToken({
      req: request,
      secret,
      cookieName: "next-auth.session-token",
      secureCookie: false,
    })
    || await getToken({
      req: request,
      secret,
      cookieName: "__Secure-next-auth.session-token",
      secureCookie: true,
    });
  const authSessionToken = socket.handshake.auth?.sessionToken;
  if (
    !token &&
    process.env.NODE_ENV !== "production" &&
    typeof authSessionToken === "string"
  ) {
    token = await decode({ token: authSessionToken, secret });
  }

  const userId = token?.userId ? String(token.userId) : "";
  if (!userId) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[GrowFi realtime] socket auth missing token", {
        hasCookieHeader: Boolean(socket.request.headers.cookie),
        cookieNames: Object.keys(request.cookies || {}),
        hasSecret: Boolean(process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET),
      });
    }
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

export function attachRealtimeServer(server: http.Server) {
  if (io) {
    return io;
  }

  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      credentials: true
    }
  });

  io.use(async (socket, next) => {
    try {
      await authenticateSocket(socket);
      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error("Socket authentication failed."));
    }
  });

  io.on("connection", (socket) => {
  if (process.env.NODE_ENV === "development") {
    const user = socket.data.user as { id?: string; username?: string } | undefined;
    console.debug("[GrowFi realtime] socket connected", {
      socketId: socket.id,
      userId: user?.id,
      username: user?.username
    });
  }

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
    if (process.env.NODE_ENV === "development") {
      console.debug("[GrowFi realtime] player joined room", {
        socketId: socket.id,
        userId: player.userId,
        room,
        playerCount: playersInRoom(room).length
      });
    }
  });

  socket.on("player:leave_room", ({ room }: { room: RealtimeRoom }) => {
    const player = playersBySocket.get(socket.id);
    if (player?.currentRoom === room) {
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
    prisma.activityLog
      .create({
        data: {
          actorId: toUserId,
          targetUserId: from.userId,
          type: "TRADE_INVITE_RECEIVED",
          message: `${from.username} sent a trade invite.`,
          metadata: { inviteId: invite.inviteId, room }
        }
      })
      .catch(() => undefined);
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

    if (
      Date.now() - invite.createdAt > TRADE_INVITE_EXPIRY_SECONDS * 1000 ||
      distanceBetween(from, recipient) > NEARBY_TRADE_DISTANCE
    ) {
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

  socket.on("chat:global:join", () => {
    socket.join("global");
    socket.emit("chat:global:history", {
      messages: globalChatHistory.slice(-100)
    });
  });

  socket.on("chat:global:message", ({ message }: { message: string }) => {
    const user = socket.data.user as {
      id: string;
      username: string;
      avatarUrl?: string | null;
    };
    if (!user?.id) {
      socket.emit("chat:global:error", { message: "Reconnect to chat." });
      return;
    }
    if (!canSendGlobalChat(user.id)) {
      socket.emit("chat:global:error", {
        message: "Slow down before sending another global message."
      });
      return;
    }
    const clean = sanitizeChatMessage(message);
    if (!clean) {
      socket.emit("chat:global:error", { message: "Message cannot be empty." });
      return;
    }
    if (clean.length > 240) {
      socket.emit("chat:global:error", {
        message: "Message is too long."
      });
      return;
    }

    const payload: GlobalChatMessagePayload = {
      id: crypto.randomUUID(),
      from: {
        userId: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl
      },
      message: clean,
      createdAt: Date.now()
    };
    globalChatHistory.push(payload);
    globalChatHistory.splice(0, Math.max(0, globalChatHistory.length - 100));
    io.to("global").emit("chat:global:message", payload);
  });

  socket.on("disconnect", () => {
    leaveCurrentRoom(socket.id);
    chatRateLimit.delete(socket.id);
    const user = socket.data.user as { id?: string } | undefined;
    if (user?.id) {
      globalChatRateLimit.delete(user.id);
    }
    tradeInviteRateLimit.delete(socket.id);
  });
  });

  return io;
}

export function startStandaloneRealtimeServer(port = PORT) {
  const server = http.createServer();
  attachRealtimeServer(server);
  server.listen(port, () => {
    console.log(`GrowFi realtime socket server listening on http://localhost:${port}`);
  });
}

if (process.argv[1]?.endsWith("server/socket.ts")) {
  startStandaloneRealtimeServer();
}
