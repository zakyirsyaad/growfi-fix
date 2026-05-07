export type RealtimeRoom =
  | "town"
  | `home:${string}`
  | `farm:${string}`;

export type PlayerDirection = "up" | "down" | "left" | "right" | "idle";

export type OnlinePlayer = {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  walletAddress?: string | null;
  currentRoom: RealtimeRoom;
  x: number;
  y: number;
  direction: PlayerDirection;
  animationState: "idle" | "walking";
  lastSeenAt: number;
};

export type MovementPayload = {
  room: RealtimeRoom;
  x: number;
  y: number;
  direction: PlayerDirection;
  animationState: "idle" | "walking";
};

export type TradeInvitePayload = {
  inviteId: string;
  from: Pick<OnlinePlayer, "userId" | "username" | "avatarUrl" | "currentRoom" | "x" | "y">;
  toUserId: string;
  room: RealtimeRoom;
  createdAt: number;
};

export type TradeInviteDeclinedPayload = {
  inviteId: string;
  fromUserId: string;
  toUserId: string;
  room: RealtimeRoom;
  reason?: string;
};

export type TradeSessionCreatedPayload = {
  inviteId: string;
  tradeId: string;
  room: RealtimeRoom;
  initiator: Pick<OnlinePlayer, "userId" | "username" | "avatarUrl">;
  recipient: Pick<OnlinePlayer, "userId" | "username" | "avatarUrl">;
};

export type ChatMessagePayload = {
  id: string;
  room: RealtimeRoom;
  from: Pick<OnlinePlayer, "userId" | "username" | "avatarUrl">;
  message: string;
  createdAt: number;
};
