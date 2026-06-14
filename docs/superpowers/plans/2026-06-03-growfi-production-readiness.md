# GrowFi Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make GrowFi safer, easier to ship, and closer to production-ready by fixing broken tooling, hardening wallet/token flows, improving backend limits, strengthening on-chain tests, and preparing realtime/economy infrastructure for scale.

**Architecture:** Keep the current Next.js + Prisma + Socket.IO + Anchor structure, but make trust boundaries explicit. Prisma remains a cache/session/index layer while wallet ownership, token movement, and core economy actions become verifiable and auditable. Each task is independently testable and should be committed separately.

**Tech Stack:** Next.js App Router, TypeScript, Prisma/PostgreSQL, NextAuth Discord, Socket.IO, TanStack Query, Phaser 3, Solana web3.js, SPL Token, Anchor, pnpm, ESLint.

---

## Current Problems Found

- `pnpm lint` fails because `@eslint/eslintrc` is imported by `eslint.config.mjs` but missing from `package.json`.
- `pnpm typecheck` fails because `@next/env` is imported by `server/dev.ts`, `server/socket.ts`, and `scripts/simulate-realtime.ts` but missing from direct dependencies.
- Repo has both `package-lock.json` and `pnpm-lock.yaml`; pick one package manager to avoid dependency drift.
- `/api/wallet/connect` accepts a wallet address without proving wallet ownership.
- Token mock mode is implicit when important env vars are missing.
- Rate limiting uses an in-memory `Map`, so it does not work reliably in production multi-instance deployments.
- Anchor tests mostly verify IDL shape; integration behavior is skipped.
- Socket presence/chat/invites are in memory, so realtime state is single-instance only.
- README says on-chain-first, but many economy operations still mutate Prisma balances/inventory directly.

---

## Phase 1: Fix Developer Tooling

### Task 1: Standardize Package Manager

**Files:**
- Modify: `package.json`
- Delete: `package-lock.json`
- Keep: `pnpm-lock.yaml`
- Keep: `pnpm-workspace.yaml`

- [ ] **Step 1: Decide pnpm as the only package manager**

Use pnpm because `pnpm-lock.yaml` and `pnpm-workspace.yaml` already exist.

- [ ] **Step 2: Remove npm lockfile**

Run:

```bash
rm package-lock.json
```

Expected: `git status --short` shows `D package-lock.json`.

- [ ] **Step 3: Add package manager metadata**

Modify `package.json` near the top:

```json
{
  "name": "growfi",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@11.3.0",
  "scripts": {
```

- [ ] **Step 4: Install missing direct dependencies**

Run:

```bash
pnpm add @next/env
pnpm add -D @eslint/eslintrc
```

Expected: `package.json` and `pnpm-lock.yaml` update.

- [ ] **Step 5: Verify tooling**

Run:

```bash
pnpm typecheck
pnpm lint
```

Expected: both commands complete without missing-package errors. If lint reports real code issues after dependency fix, fix them in the same task.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml pnpm-workspace.yaml package-lock.json
git commit -m "chore: standardize pnpm tooling"
```

---

## Phase 2: Wallet Ownership Security

### Task 2: Add Wallet Nonce Challenge

**Files:**
- Modify: `prisma/schema.prisma`
- Create migration: `prisma/migrations/<timestamp>_wallet_challenge/migration.sql`
- Create: `app/api/wallet/challenge/route.ts`
- Modify: `lib/validations/schemas.ts`

- [ ] **Step 1: Add wallet challenge fields**

Add to `model User` in `prisma/schema.prisma`:

```prisma
  walletChallengeNonce     String?
  walletChallengeExpiresAt DateTime?
```

- [ ] **Step 2: Create migration**

Run:

```bash
pnpm prisma migrate dev --name wallet_challenge
```

Expected: Prisma creates a migration and regenerates client types.

- [ ] **Step 3: Add validation schema**

Add to `lib/validations/schemas.ts`:

```ts
export const walletChallengeSchema = z.object({
  walletAddress: z.string().min(32).max(64)
});
```

- [ ] **Step 4: Create challenge endpoint**

Create `app/api/wallet/challenge/route.ts`:

```ts
import crypto from "node:crypto";
import { PublicKey } from "@solana/web3.js";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { GameError } from "@/lib/game/errors";
import { handleApiError, ok, parseJson } from "@/lib/utils/api";
import { rateLimit } from "@/lib/utils/rate-limit";
import { walletChallengeSchema } from "@/lib/validations/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    rateLimit(`wallet-challenge:${user.id}`, 10, 60_000);
    const input = await parseJson(request, walletChallengeSchema);

    let wallet: PublicKey;
    try {
      wallet = new PublicKey(input.walletAddress);
    } catch {
      throw new GameError("Wallet address is not a valid Solana address.", 422);
    }

    const nonce = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 5 * 60_000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        walletChallengeNonce: nonce,
        walletChallengeExpiresAt: expiresAt
      }
    });

    return ok({
      walletAddress: wallet.toBase58(),
      message: `GrowFi wallet verification\nUser: ${user.id}\nWallet: ${wallet.toBase58()}\nNonce: ${nonce}\nExpires: ${expiresAt.toISOString()}`
    });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 5: Verify migration and typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add prisma app/api/wallet/challenge/route.ts lib/validations/schemas.ts
git commit -m "feat: add wallet verification challenge"
```

### Task 3: Require Signature on Wallet Connect

**Files:**
- Modify: `lib/validations/schemas.ts`
- Modify: `app/api/wallet/connect/route.ts`
- Modify: `components/game/WalletGate.tsx`
- Modify: `components/wallet/WalletDashboard.tsx` if it also connects wallets directly

- [ ] **Step 1: Update connect schema**

Replace `connectWalletSchema` in `lib/validations/schemas.ts`:

```ts
export const connectWalletSchema = z.object({
  walletAddress: z.string().min(32).max(64),
  message: z.string().min(20).max(1_000),
  signature: z.string().min(32).max(512)
});
```

- [ ] **Step 2: Verify signature server-side**

Update `app/api/wallet/connect/route.ts` to verify the Solana signature before calling `connectWallet`:

```ts
import bs58 from "bs58";
import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { GameError } from "@/lib/game/errors";
import { connectWallet } from "@/lib/game/service";
import { handleApiError, ok, parseJson } from "@/lib/utils/api";
import { rateLimit } from "@/lib/utils/rate-limit";
import { connectWalletSchema } from "@/lib/validations/schemas";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    rateLimit(`wallet-connect:${user.id}`, 10, 60_000);
    const input = await parseJson(request, connectWalletSchema);

    const wallet = new PublicKey(input.walletAddress);
    const freshUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        walletChallengeNonce: true,
        walletChallengeExpiresAt: true
      }
    });

    if (
      !freshUser.walletChallengeNonce ||
      !freshUser.walletChallengeExpiresAt ||
      freshUser.walletChallengeExpiresAt.getTime() < Date.now()
    ) {
      throw new GameError("Wallet verification challenge has expired.", 409);
    }

    if (!input.message.includes(freshUser.walletChallengeNonce)) {
      throw new GameError("Wallet verification challenge does not match.", 409);
    }

    const verified = nacl.sign.detached.verify(
      new TextEncoder().encode(input.message),
      bs58.decode(input.signature),
      wallet.toBytes()
    );

    if (!verified) {
      throw new GameError("Wallet signature is invalid.", 401);
    }

    const connected = await connectWallet(user.id, wallet.toBase58());
    await prisma.user.update({
      where: { id: user.id },
      data: {
        walletChallengeNonce: null,
        walletChallengeExpiresAt: null
      }
    });

    return ok({ user: connected });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 3: Install signature dependency**

Run:

```bash
pnpm add tweetnacl
```

- [ ] **Step 4: Update frontend wallet connect**

In `components/game/WalletGate.tsx`, replace the current direct `/api/wallet/connect` call with:

```ts
const challenge = await apiFetch<{ message: string; walletAddress: string }>(
  "/api/wallet/challenge",
  {
    method: "POST",
    body: JSON.stringify({ walletAddress }),
  }
);

if (!wallet.signMessage) {
  throw new Error("This wallet does not support message signing.");
}

const signatureBytes = await wallet.signMessage(
  new TextEncoder().encode(challenge.message)
);

await apiFetch("/api/wallet/connect", {
  method: "POST",
  body: JSON.stringify({
    walletAddress: challenge.walletAddress,
    message: challenge.message,
    signature: bs58.encode(signatureBytes),
  }),
});
```

Also add:

```ts
import bs58 from "bs58";
```

- [ ] **Step 5: Verify**

Run:

```bash
pnpm typecheck
pnpm lint
```

Expected: PASS.

- [ ] **Step 6: Manual test**

1. Login with Discord.
2. Connect Phantom/Solflare.
3. Confirm the wallet signature popup appears.
4. Verify `walletAddress` is saved only after signing.

- [ ] **Step 7: Commit**

```bash
git add app/api/wallet lib/validations/schemas.ts components/game/WalletGate.tsx components/wallet/WalletDashboard.tsx package.json pnpm-lock.yaml prisma
git commit -m "feat: verify wallet ownership before connect"
```

---

## Phase 3: Token Mode Hardening

### Task 4: Make Mock Mode Explicit

**Files:**
- Modify: `lib/solana/token.ts`
- Modify: `lib/env/solana.ts`
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Replace implicit mock detection**

In `lib/solana/token.ts`, replace:

```ts
export function isMockTokenMode() {
  return !process.env.GROW_TOKEN_MINT || !process.env.TREASURY_WALLET_PUBLIC_KEY;
}
```

with:

```ts
export function isMockTokenMode() {
  return process.env.TOKEN_MODE === "mock";
}

export function assertTokenRuntimeConfigured() {
  if (isMockTokenMode()) {
    if (process.env.NODE_ENV === "production") {
      throw new GameError("TOKEN_MODE=mock is not allowed in production.", 500);
    }
    return;
  }

  const missing = [
    "GROW_TOKEN_MINT",
    "TREASURY_WALLET_PUBLIC_KEY",
    "TREASURY_WALLET_SECRET_KEY"
  ].filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new GameError(`Missing token env: ${missing.join(", ")}`, 500);
  }
}
```

- [ ] **Step 2: Call runtime assertion**

At the start of `verifyGrowDeposit` and `sendGrowWithdrawal`, add:

```ts
assertTokenRuntimeConfigured();
```

- [ ] **Step 3: Update env docs**

In `.env.example` and `README.md`, document:

```bash
TOKEN_MODE=devnet
# TOKEN_MODE=mock is local-only and must never be used in production.
```

- [ ] **Step 4: Verify**

Run:

```bash
pnpm typecheck
pnpm lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/solana/token.ts lib/env/solana.ts .env.example README.md
git commit -m "fix: make token mock mode explicit"
```

---

## Phase 4: Production Rate Limiting

### Task 5: Add Redis-Compatible Rate Limiter

**Files:**
- Modify: `lib/utils/rate-limit.ts`
- Modify: `.env.example`
- Modify: `README.md`
- Optional create: `lib/utils/rate-limit-memory.ts`

- [ ] **Step 1: Install Upstash Redis**

Run:

```bash
pnpm add @upstash/redis
```

- [ ] **Step 2: Replace Map limiter with Redis-first limiter**

Use Redis when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are present. Keep memory fallback only for local development.

```ts
import { Redis } from "@upstash/redis";
import { GameError } from "@/lib/game/errors";

const buckets = new Map<string, { count: number; resetAt: number }>();

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN
      })
    : null;

function memoryRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (bucket.count >= limit) {
    throw new GameError("Too many requests. Slow down a little.", 429);
  }

  bucket.count += 1;
}

export async function rateLimit(key: string, limit = 30, windowMs = 60_000) {
  if (!redis) {
    if (process.env.NODE_ENV === "production") {
      throw new GameError("Redis rate limiter is not configured.", 500);
    }
    memoryRateLimit(key, limit, windowMs);
    return;
  }

  const redisKey = `rate:${key}`;
  const count = await redis.incr(redisKey);
  if (count === 1) {
    await redis.pexpire(redisKey, windowMs);
  }
  if (count > limit) {
    throw new GameError("Too many requests. Slow down a little.", 429);
  }
}
```

- [ ] **Step 3: Update all callers**

Because `rateLimit` becomes async, update every API route and socket helper call:

```ts
await rateLimit(`wallet-connect:${user.id}`, 10, 60_000);
```

Search command:

```bash
rg "rateLimit\\("
```

- [ ] **Step 4: Document env**

Add to `.env.example`:

```bash
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

- [ ] **Step 5: Verify**

Run:

```bash
pnpm typecheck
pnpm lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/utils/rate-limit.ts app/api server .env.example README.md package.json pnpm-lock.yaml
git commit -m "feat: add persistent rate limiting"
```

---

## Phase 5: Anchor Test Coverage

### Task 6: Replace Skipped IDL Tests With Real Behavior Tests

**Files:**
- Modify: `anchor/tests/growfi_core.ts`
- Optional create: `anchor/tests/helpers.ts`
- Modify: `anchor/package.json`

- [ ] **Step 1: Keep IDL test but remove skipped placeholders**

Delete the `it.skip` loop in `anchor/tests/growfi_core.ts`. Skipped tests create false confidence.

- [ ] **Step 2: Add integration test helper**

Create `anchor/tests/helpers.ts`:

```ts
import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";

export function provider() {
  return anchor.AnchorProvider.env();
}

export function randomId() {
  return new anchor.BN(Date.now() + Math.floor(Math.random() * 100_000));
}

export function sha32(label: string) {
  return Array.from(Buffer.from(label.padEnd(32, "_").slice(0, 32)));
}

export function keypair() {
  return Keypair.generate();
}

export async function airdrop(connection: anchor.web3.Connection, publicKey: PublicKey) {
  const sig = await connection.requestAirdrop(publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig, "confirmed");
}
```

- [ ] **Step 3: Add first real tests**

Add behavior tests in `anchor/tests/growfi_core.ts` for:

- initialize config
- create player
- create farm
- create initial plot
- reject duplicate player/farm
- reject unauthorized config update

- [ ] **Step 4: Run Anchor build/test**

Run:

```bash
pnpm anchor:build
pnpm anchor:test
```

Expected: no skipped integration placeholders remain. If local validator tooling is missing, run:

```bash
cd anchor && anchor test --skip-build --skip-deploy --skip-local-validator
```

and document the missing validator dependency in the PR notes.

- [ ] **Step 5: Commit**

```bash
git add anchor/tests anchor/package.json anchor/package-lock.json
git commit -m "test: add core anchor behavior coverage"
```

### Task 7: Add Economy Abuse Tests

**Files:**
- Modify: `anchor/tests/growfi_core.ts`

- [ ] **Step 1: Add negative test cases**

Add tests for:

- buy seed fails when shop expired
- buy seed fails when quantity exceeds stock
- plant seed fails when plot is not empty
- harvest fails before ready time
- marketplace buy fails when listing expired
- trade complete fails without both confirmations
- non-admin cannot pause/update config

- [ ] **Step 2: Verify**

Run:

```bash
pnpm anchor:test
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add anchor/tests/growfi_core.ts
git commit -m "test: cover growfi economy abuse cases"
```

---

## Phase 6: Economy Source-of-Truth Alignment

### Task 8: Add Economy Mode Documentation

**Files:**
- Create: `docs/economy-source-of-truth.md`
- Modify: `README.md`

- [ ] **Step 1: Create source-of-truth document**

Create `docs/economy-source-of-truth.md`:

```md
# GrowFi Economy Source of Truth

## Current Mode

GrowFi currently runs in hybrid mode:

- On-chain Anchor accounts are the intended source of truth for production economy.
- Prisma stores Discord auth, metadata, user-facing cache, activity logs, and MVP gameplay state.
- Token deposit and withdrawal bridge wallet balances into the in-game Prisma balance.

## Production Direction

Production economy must move toward:

- SPL token balances for spendable $GROW.
- Anchor PDAs for player, farm, plot, seed inventory, fruit inventory, shop purchases, marketplace listings, and trades.
- Prisma as an indexed cache only.

## Rules

- Never trust client-submitted balances.
- Every token credit must be backed by a verified transaction signature or Anchor event.
- Every Prisma economy mutation must be idempotent.
- Every cache update must be recoverable from on-chain state or transaction history.

## Migration Plan

1. Keep Prisma gameplay for local MVP.
2. Add event indexer for Anchor events.
3. Add reconciliation job comparing Prisma cache against on-chain PDAs.
4. Move shop, marketplace, trade, and harvest settlement to Anchor-first flows.
5. Remove direct Prisma balance mutation for production token economy.
```

- [ ] **Step 2: Link it from README**

Add under On-Chain Architecture:

```md
See `docs/economy-source-of-truth.md` for the current hybrid-mode boundary and production migration plan.
```

- [ ] **Step 3: Commit**

```bash
git add docs/economy-source-of-truth.md README.md
git commit -m "docs: define economy source of truth"
```

### Task 9: Add Transaction Metadata for Deposit Auditing

**Files:**
- Modify: `lib/solana/token.ts`
- Modify: `lib/game/service.ts`
- Modify: `prisma/schema.prisma` only if stronger unique constraints are needed

- [ ] **Step 1: Return full verified deposit details**

In `verifyGrowDeposit`, return:

```ts
return {
  signature: params.signature,
  rawAmount: expectedRaw,
  mock: false,
  mint: mint.toBase58(),
  treasuryAta: treasuryAta.toBase58(),
  userWallet: userWallet.toBase58(),
  slot: tx.slot
};
```

- [ ] **Step 2: Store metadata**

In `verifyDeposit` inside `lib/game/service.ts`, update transaction metadata:

```ts
metadata: {
  rawAmount: verified.rawAmount.toString(),
  mock: verified.mock,
  mint: verified.mint,
  treasuryAta: verified.treasuryAta,
  userWallet: verified.userWallet,
  slot: verified.slot
}
```

- [ ] **Step 3: Verify**

Run:

```bash
pnpm typecheck
pnpm lint
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/solana/token.ts lib/game/service.ts
git commit -m "fix: persist verified deposit audit metadata"
```

---

## Phase 7: Realtime Production Path

### Task 10: Add Realtime Scale Plan Before Code Changes

**Files:**
- Create: `docs/realtime-production-plan.md`
- Modify: `README.md`

- [ ] **Step 1: Document current limitation**

Create `docs/realtime-production-plan.md`:

```md
# GrowFi Realtime Production Plan

## Current State

Socket.IO state is held in process memory:

- connected players
- movement positions
- global chat history
- pending trade invites
- chat and invite rate limits

This is acceptable for a single MVP server only.

## Production Requirements

- Use Socket.IO Redis adapter for multi-instance fanout.
- Store important chat/trade invite events in Redis or Postgres.
- Keep ephemeral movement in Redis with short TTL.
- Use Redis-backed rate limits.
- Add disconnect/reconnect recovery for active room state.

## Implementation Order

1. Add Redis dependency already used by API rate limiter.
2. Add Socket.IO Redis adapter.
3. Move pending trade invites to Redis with expiry.
4. Move global chat history to Redis list with capped length.
5. Add metrics for active sockets, rooms, dropped messages, and auth failures.
```

- [ ] **Step 2: Link from README**

Add under MVP Multiplayer Scope:

```md
For production scaling limits and migration order, see `docs/realtime-production-plan.md`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/realtime-production-plan.md README.md
git commit -m "docs: define realtime production path"
```

---

## Phase 8: Game UX and Performance

### Task 11: Reduce Unnecessary Game Renders

**Files:**
- Modify: `components/game/GameClient.tsx`
- Modify: `components/game/GameCanvas.tsx`
- Modify: `components/game/GameOverlay.tsx`

- [ ] **Step 1: Profile current render behavior**

Run local app:

```bash
pnpm dev
```

Open `/game`, use React DevTools Profiler, and record:

- initial load
- garden refetch
- opening inventory overlay
- opening marketplace overlay

- [ ] **Step 2: Prevent Phaser canvas from receiving irrelevant props**

Keep `GameCanvas` responsible only for booting Phaser. Send garden updates through event bus from `GameClient` and wrap `GameCanvas` in `memo`.

Expected shape:

```ts
export const GameCanvas = memo(function GameCanvas() {
  // boot Phaser once
});
```

- [ ] **Step 3: Move garden event emit to GameClient**

In `GameClient`, emit:

```ts
useEffect(() => {
  if (displayGarden) {
    gameEventBus.emit("gardenStateUpdated", displayGarden);
  }
}, [displayGarden]);
```

- [ ] **Step 4: Verify**

Run:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Expected: PASS.

- [ ] **Step 5: Manual test**

1. Open `/game`.
2. Confirm Phaser loads once.
3. Confirm farm state still updates after planting/watering/harvesting.
4. Confirm overlays still open.

- [ ] **Step 6: Commit**

```bash
git add components/game/GameClient.tsx components/game/GameCanvas.tsx components/game/GameOverlay.tsx
git commit -m "perf: reduce game canvas rerenders"
```

---

## Final Verification Checklist

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm build`
- [ ] `pnpm prisma generate`
- [ ] `pnpm anchor:build`
- [ ] `pnpm anchor:test`
- [ ] Manual login with Discord
- [ ] Manual wallet connect with signature popup
- [ ] Manual devnet mint only when devnet helper env is enabled
- [ ] Manual deposit verify
- [ ] Manual withdraw
- [ ] Manual plant/water/harvest
- [ ] Manual marketplace list/buy/cancel
- [ ] Manual trade invite/confirm/cancel
- [ ] Manual realtime presence with at least two browser sessions

---

## Recommended Execution Order

1. Phase 1: tooling
2. Phase 2: wallet signature security
3. Phase 3: token mock-mode hardening
4. Phase 4: persistent rate limiting
5. Phase 5: Anchor tests
6. Phase 6: economy source-of-truth alignment
7. Phase 7: realtime production path
8. Phase 8: game UX/performance

Do not start Phase 5 or later until `pnpm typecheck`, `pnpm lint`, and `pnpm build` are clean.

