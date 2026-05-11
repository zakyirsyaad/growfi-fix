import { io, type Socket } from "socket.io-client";
import { loadEnvConfig } from "@next/env";
import { encode } from "next-auth/jwt";
import { prisma } from "@/lib/db/prisma";
import type { GlobalChatMessagePayload, OnlinePlayer, RealtimeRoom } from "@/lib/realtime/types";

loadEnvConfig(process.cwd());

type TestUser = {
  id: string;
  username: string;
  discordId: string;
};

type RoomPlayersPayload = { room: RealtimeRoom; players: OnlinePlayer[] };

const realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_URL || "http://localhost:3000";
const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
const testUsers = [
  { discordId: "growfi-realtime-sim-1", username: "Realtime Alpha" },
  { discordId: "growfi-realtime-sim-2", username: "Realtime Beta" },
  { discordId: "growfi-realtime-sim-3", username: "Realtime Gamma" },
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureUsers() {
  return Promise.all(
    testUsers.map((user) =>
      prisma.user.upsert({
        where: { discordId: user.discordId },
        create: {
          discordId: user.discordId,
          username: user.username,
        },
        update: {
          username: user.username,
        },
        select: {
          id: true,
          username: true,
          discordId: true,
        },
      })
    )
  );
}

async function sessionToken(user: TestUser) {
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET or AUTH_SECRET is required for socket auth simulation.");
  }

  return encode({
    secret,
    token: {
      sub: user.id,
      userId: user.id,
      name: user.username,
    },
  });
}

function sessionCookie(token: string) {
  return [
    `next-auth.session-token=${token}`,
    `__Secure-next-auth.session-token=${token}`,
  ].join("; ");
}

function waitForEvent<T>(
  socket: Socket,
  event: string,
  predicate: (payload: T) => boolean,
  label: string,
  timeoutMs = 5_000
) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for ${label}.`));
    }, timeoutMs);
    const handler = (payload: T) => {
      if (!predicate(payload)) {
        return;
      }
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });
}

async function connectClient(user: TestUser) {
  const token = await sessionToken(user);
  const cookie = sessionCookie(token);
  const socket = io(realtimeUrl, {
    withCredentials: true,
    transports: ["websocket", "polling"],
    reconnection: false,
    timeout: 5_000,
    auth: {
      sessionToken: token,
    },
    extraHeaders: {
      Cookie: cookie,
    },
  });

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${user.username} connect timeout.`)), 5_000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });

  return socket;
}

function joinRoom(socket: Socket, room: RealtimeRoom, x: number, y: number) {
  socket.emit("player:join_room", { room, x, y });
}

async function main() {
  const users = await ensureUsers();
  const [alpha, beta, gamma] = users;
  const sockets: Socket[] = [];

  try {
    console.log(`[simulate] connecting 3 clients to ${realtimeUrl}`);
    const alphaSocket = await connectClient(alpha);
    const betaSocket = await connectClient(beta);
    const gammaSocket = await connectClient(gamma);
    sockets.push(alphaSocket, betaSocket, gammaSocket);
    console.log("[simulate] connected:", users.map((user) => `${user.username}:${user.id}`).join(", "));

    const alphaTownReady = waitForEvent<RoomPlayersPayload>(
      alphaSocket,
      "room:players",
      (payload) => payload.room === "town" && payload.players.length === 0,
      "alpha empty town room"
    );
    joinRoom(alphaSocket, "town", 100, 100);
    await alphaTownReady;

    const alphaSeesBeta = waitForEvent<OnlinePlayer>(
      alphaSocket,
      "player:joined",
      (player) => player.userId === beta.id && player.currentRoom === "town",
      "alpha sees beta join town"
    );
    const betaSeesAlpha = waitForEvent<RoomPlayersPayload>(
      betaSocket,
      "room:players",
      (payload) =>
        payload.room === "town" && payload.players.some((player) => player.userId === alpha.id),
      "beta receives alpha in town"
    );
    joinRoom(betaSocket, "town", 180, 100);
    await Promise.all([alphaSeesBeta, betaSeesAlpha]);

    const gammaSeesTwo = waitForEvent<RoomPlayersPayload>(
      gammaSocket,
      "room:players",
      (payload) =>
        payload.room === "town" &&
        payload.players.some((player) => player.userId === alpha.id) &&
        payload.players.some((player) => player.userId === beta.id),
      "gamma receives alpha and beta in town"
    );
    joinRoom(gammaSocket, "town", 260, 100);
    await gammaSeesTwo;
    console.log("[simulate] town presence ok: 3 players share room town");

    await sleep(80);
    const betaSeesAlphaMove = waitForEvent<OnlinePlayer>(
      betaSocket,
      "player:moved",
      (player) => player.userId === alpha.id && player.x === 116 && player.y === 100,
      "beta sees alpha move"
    );
    const gammaSeesAlphaMove = waitForEvent<OnlinePlayer>(
      gammaSocket,
      "player:moved",
      (player) => player.userId === alpha.id && player.x === 116 && player.y === 100,
      "gamma sees alpha move"
    );
    alphaSocket.emit("player:move", {
      room: "town",
      x: 116,
      y: 100,
      direction: "right",
      animationState: "walking",
    });
    await Promise.all([betaSeesAlphaMove, gammaSeesAlphaMove]);
    console.log("[simulate] movement broadcast ok: alpha move reached beta and gamma");

    const betaGlobalChat = waitForEvent<GlobalChatMessagePayload>(
      betaSocket,
      "chat:global:message",
      (message) => message.from.userId === alpha.id && message.message === "hello from alpha",
      "beta receives global chat"
    );
    alphaSocket.emit("chat:global:join");
    betaSocket.emit("chat:global:join");
    gammaSocket.emit("chat:global:join");
    await sleep(50);
    alphaSocket.emit("chat:global:message", { message: "hello from alpha" });
    await betaGlobalChat;
    console.log("[simulate] global chat ok");

    const alphaSeesGammaLeave = waitForEvent<{ userId: string; room: RealtimeRoom }>(
      alphaSocket,
      "player:left",
      (payload) => payload.room === "town" && payload.userId === gamma.id,
      "alpha sees gamma leave town"
    );
    gammaSocket.emit("player:leave_room", { room: "town" });
    await alphaSeesGammaLeave;
    console.log("[simulate] leave room ok: gamma removed from town");

    const alphaHomeReady = waitForEvent<RoomPlayersPayload>(
      alphaSocket,
      "room:players",
      (payload) => payload.room === `home:${alpha.id}` && payload.players.length === 0,
      "alpha home room ready"
    );
    joinRoom(alphaSocket, `home:${alpha.id}`, 120, 240);
    await alphaHomeReady;

    const alphaSeesBetaHome = waitForEvent<OnlinePlayer>(
      alphaSocket,
      "player:joined",
      (player) => player.userId === beta.id && player.currentRoom === `home:${alpha.id}`,
      "alpha sees beta visit alpha home"
    );
    const betaSeesAlphaHome = waitForEvent<RoomPlayersPayload>(
      betaSocket,
      "room:players",
      (payload) =>
        payload.room === `home:${alpha.id}` &&
        payload.players.some((player) => player.userId === alpha.id),
      "beta receives alpha in alpha home"
    );
    joinRoom(betaSocket, `home:${alpha.id}`, 160, 240);
    await Promise.all([alphaSeesBetaHome, betaSeesAlphaHome]);
    console.log("[simulate] shared farm room ok: visitor joined home:{ownerId}");

    console.log("[simulate] PASS: 3-player realtime simulation completed");
  } finally {
    sockets.forEach((socket) => socket.disconnect());
    await prisma.user.deleteMany({
      where: { discordId: { in: testUsers.map((user) => user.discordId) } },
    });
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error("[simulate] FAIL", error);
  await prisma.$disconnect();
  process.exit(1);
});
