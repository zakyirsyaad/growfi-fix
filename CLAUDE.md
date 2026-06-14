# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

GrowFi is a Stardew Valley-inspired browser-based 2D farming GameFi. Players log in with Discord, connect a Solana wallet, enter a Phaser 3 top-down world, farm crops, trade fruit, and move `$GROW` (an SPL token) through an on-chain economy. The app is mid-migration from a Prisma-authoritative economy to an **on-chain-first** model where the Anchor program `anchor/programs/growfi_core` is the source of truth.

## Commands

Package manager is **pnpm** (`pnpm@11.3.0`). All scripts below run via `pnpm <script>`.

- `pnpm dev` — runs the **unified server** (`server/dev.ts`): Next.js + Socket.io realtime on one port (3000). Use this, not `dev:next`, when you need realtime/multiplayer.
- `pnpm dev:next` — Next.js only (no realtime).
- `pnpm build` / `pnpm start` — production Next build/serve. `pnpm start:unified` serves the unified server in prod mode.
- `pnpm lint` — ESLint. `pnpm typecheck` — runs `next typegen` then `tsc --noEmit` (run this after type-affecting changes).
- `pnpm prisma:generate` / `pnpm prisma:migrate` / `pnpm prisma:seed` — Prisma client, migrations, and seed (`prisma/seed.ts`).
- `pnpm anchor:build` / `pnpm anchor:test` / `pnpm anchor:deploy:devnet` — Anchor program lifecycle (run from repo root; they `cd anchor`).

### Anchor / Solana toolchain caveats

Full `anchor test` requires the Solana SBF toolchain and (for Anchor CLI 1.0.x) Surfpool as the local validator. If `build-sbf` or `surfpool` is missing, do **not** treat integration tests as verified. The IDL smoke suite runs without SBF:

```bash
cd anchor && npm exec -- ts-mocha -p ./tsconfig.json -t 1000000 "tests/**/*.ts"
# or skip the validator entirely:
anchor test --skip-build --skip-deploy --skip-local-validator
```

There is no JS unit-test runner in this repo; verification is `lint` + `typecheck` + Anchor tests.

## Architecture

### Three-layer system
1. **Phaser game** (`lib/game/phaser/`) — owns movement, map rendering, collisions, interactable zones, plot visuals, and area transitions. It **never** mutates the DB. Scenes: `BootScene → PreloadScene → FarmScene / TownScene`. Systems (camera, farm plots, interaction, map transition, multiplayer, presence, remote players) live in `lib/game/phaser/systems/`. Entry point: `createGrowFiGame()` in `GrowFiGame.ts`.
2. **React overlays** (`components/game/`) — authenticated state, modals/sheets/drawers, wallet controls, marketplace, trade, profile, etc. `GameClient.tsx` is the bridge: it fetches state via TanStack Query, merges on-chain state, and pushes it into Phaser.
3. **API routes + service layer** (`app/api/`, `lib/game/service.ts`) — server-side validation and the authoritative game logic.

### Phaser ↔ React bridge
The two worlds communicate **only** through `gameEventBus` (`lib/game/eventBus.ts`), a typed pub/sub singleton. Phaser emits intent events (`selectPlot`, `openOverlay`, `interact`, `visitFarm`, `areaChanged`, …); React listens, performs an API call, then emits `gardenStateUpdated` / `refreshFarmState` back to Phaser. When adding a new overlay or interactable, register it in the `GameOverlayKey` / `GameInteractableType` / `GameBusEvents` types in `eventBus.ts`. Cross-cutting client state lives in `store/useGameStore.ts` (Zustand).

### Economy: hybrid on-chain / Prisma boundary
Read `docs/economy-source-of-truth.md` before touching any balance, shop, marketplace, trade, or harvest logic. Current rules:
- **On-chain (Anchor PDAs + SPL `$GROW`)** is the intended production source of truth: player/farm/plot/inventory/shop/listing/trade/creator/decoration/challenge accounts. Token moves use `anchor-spl` checked transfers.
- **Prisma/Postgres** holds Discord auth, metadata, MVP gameplay state, activity logs, and an indexed cache. Deposit/withdraw bridges wallet balances into the in-game Prisma balance.
- **Never trust client-submitted balances.** Every token credit must be backed by a verified tx signature or Anchor event; every economy mutation must be idempotent.

### Server-side game logic
`lib/game/service.ts` is the large authoritative module: planting, watering, harvesting, shop rotation/purchase, listings, trades, stamina, quests, tutorial. It uses Prisma interactive transactions with explicit `maxWait`/`timeout`. Tunables (stamina costs, caps, fees, durations, rarity weights) live in `lib/game/constants.ts`. Mutation/price rolls in `lib/game/mutation.ts`, stamina in `lib/game/stamina.ts`. API routes are thin wrappers that call `getCurrentUser()` (`lib/auth/server.ts`) then the service.

### Solana client/server split
- Server token operations: `lib/solana/token.ts` (`import "server-only"`; treasury/mint keypairs). `TOKEN_MODE` is `mock` | `devnet` | `mainnet`; **`mock` throws in production**.
- Anchor client helpers: `lib/solana/growfiCore.ts`, `growfiData.ts`, `client.ts`; IDL at `lib/idl/growfi_core.json`. React hooks for on-chain reads: `lib/solana/useGrowfiProgram` (used by `GameClient`).
- Env validation: `lib/env/solana.ts` gates devnet-only server helpers (`ENABLE_DEVNET_SERVER_MINT`, `ENABLE_DEVNET_SHOP_AUTOMATION`).

### Realtime / multiplayer
`server/socket.ts` (`attachRealtimeServer`) is mounted onto the unified HTTP server. Rooms: `town` (shared TownScene), `home:{ownerId}` (farm visits), `chat:global:*`. Client: `lib/realtime/socketClient.ts`, types in `lib/realtime/types.ts`. Visitors can see remote players but cannot mutate another player's crops (MVP). See `docs/realtime-production-plan.md` for scaling limits.

### Auth
NextAuth + Discord OAuth (`lib/auth/options.ts`), Prisma adapter. Server routes get the user via `getCurrentUser()`, which also calls `ensureStarterGarden()`. `/game` is wrapped in `<WalletGate>` requiring a verified wallet before entry.

### Routes
`/game` is the main experience. `/wallet`, `/marketplace`, `/profile`, `/leaderboard` are standalone pages. `/play`, `/shop`, `/inventory`, `/trade` are **legacy** migration routes.

## Conventions
- Path alias `@/` maps to repo root.
- UI is shadcn/ui + TailwindCSS; components in `components/ui/`, `cn` helper in `lib/utils.ts`, CSS variables in `app/globals.css`.
- Validation via Zod schemas in `lib/validations/schemas.ts`.
- Service-layer errors throw `GameError(message, statusCode)` (`lib/game/errors.ts`); API routes translate these to HTTP responses.
- Secrets (treasury, mint authority, admin keys) are server-only and must never be exposed to `NEXT_PUBLIC_*` env or the frontend.
