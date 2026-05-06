# GrowFi

GrowFi is a Stardew Valley-inspired browser-based 2D farming GameFi MVP. Players log in with Discord, connect a Solana wallet, enter a Phaser 3 top-down world, walk around their farm and town, buy seeds, plant and water crops, harvest mutated fruit, list or buy fruit in the marketplace, create direct trades, and move `$GROW` through the hybrid game economy.

The app keeps the Solana and hybrid architecture from the original GrowFi design: fast gameplay state is validated off-chain in PostgreSQL through Prisma, while `$GROW` deposit and withdrawal paths use Solana SPL token transfers when token configuration is present. If the token mint is not configured, local mock mode lets the game loop run for demos.

## Tech Stack

- Next.js App Router + TypeScript
- Phaser 3 for the 2D top-down game canvas
- React overlays for inventory, shop, marketplace, trade, wallet, profile, and activity
- shadcn/ui + TailwindCSS for non-Phaser UI
- Prisma + PostgreSQL, Supabase-compatible
- NextAuth with Discord OAuth
- Solana wallet adapter, `@solana/web3.js`, `@solana/spl-token`
- TanStack Query, Zustand, Zod

## How Phaser And React Work Together

- Phaser owns character movement, map rendering, collisions, interactable zones, farm plot visuals, and area transitions.
- React owns authenticated state, modals, sheets, drawers, tables, forms, toasts, wallet controls, marketplace, trade, and profile UI.
- Phaser never mutates the database directly. It emits intent events such as `selectPlot`, `openSeedShop`, `openMarketplace`, `openTrade`, and `visitFarm`.
- React/API routes perform server-side validation for planting, watering, harvesting, shop purchases, listings, trades, stamina, balances, and timestamps.
- After a successful action, TanStack Query refetches state and sends the fresh garden state back into Phaser.

## Main Routes

- `/` landing page
- `/game` main playable 2D game
- `/wallet` wallet deposit, withdraw, and transaction page
- `/marketplace` marketplace browse/list/buy page
- `/profile` farmer profile page
- `/leaderboard` leaderboard page

Legacy routes like `/play`, `/shop`, `/inventory`, and `/trade` may still exist during migration, but `/game` is the main experience.

## Controls

Desktop:

- `WASD` or arrow keys to move
- `E` or `Space` to interact
- `Shift` to sprint locally

Mobile/tablet:

- Virtual joystick bottom-left
- Interact button bottom-right
- Quick buttons for Bag, Shop, Market, Wallet, and Menu

## Game Areas

- Home Farm: farm plots, house spawn, mailbox/activity log, expandable plot area, and path to town.
- Town Area: seed shop building/NPC, marketplace board, trade board, leaderboard board, farm visit portal, and wallet/bank object.
- Seed Shop: global rotating limited stock with countdown, rarity, price, max buy, and user purchase caps.
- Marketplace Area: overlay UI for browsing, buying, listing, and cancelling fruit listings.
- Trade Area: overlay UI for asynchronous direct trades.
- Other User Farm: read-only farm visit mode with owner stats and trade request support.

## MVP Multiplayer Scope

GrowFi does not implement real-time multiplayer movement yet. Each user sees their own local farmer character. Visiting another farm loads that owner’s garden state in read-only mode, and visitors cannot plant, water, harvest, or modify another player’s crops in the MVP.

The event bus and scene boundaries are intentionally ready for future WebSocket presence, but full MMO-style movement is not included.

## shadcn/ui Setup

This repo includes the shadcn-style setup:

- `components.json`
- Tailwind CSS variables in `app/globals.css`
- `cn` utility in `lib/utils.ts`
- shadcn-compatible component files in `components/ui`
- `lucide-react` icons
- `class-variance-authority`

Equivalent setup commands:

```bash
npx shadcn@latest init
npx shadcn@latest add button card dialog sheet drawer tabs badge progress tooltip dropdown-menu select input label separator table scroll-area avatar skeleton sonner alert popover command form
```

## Environment

Required for core app:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/growfi?schema=public
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=replace-with-a-long-random-secret
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
```

Solana settings:

```bash
SOLANA_RPC_URL=https://api.devnet.solana.com
GROW_TOKEN_MINT=
TREASURY_WALLET_PUBLIC_KEY=
TREASURY_WALLET_PRIVATE_KEY=
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_GROW_TOKEN_MINT=
NEXT_PUBLIC_TREASURY_WALLET_PUBLIC_KEY=
NEXT_PUBLIC_MOCK_TOKEN_MODE=true
```

When `GROW_TOKEN_MINT` or `TREASURY_WALLET_PUBLIC_KEY` is empty, deposits and withdrawals use mock signatures and in-game balance updates for local testing.

## Run Locally

```bash
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:seed
npm run dev
```

Open `http://localhost:3000`.

Main demo loop:

1. Log in with Discord.
2. Connect a Solana wallet.
3. Enter `/game`.
4. Walk to town and open the seed shop.
5. Buy seed with in-game `$GROW`.
6. Return to the home farm.
7. Stand near a plot and interact to plant.
8. Water, wait, harvest, then sell/list/trade fruit.
9. Use wallet pages or overlays to deposit/withdraw `$GROW`.

## Implemented MVP Features

- Discord login with automatic starter account and garden creation
- Solana wallet connect and wallet address persistence
- Phaser 3 top-down farm and town maps
- Keyboard and mobile joystick movement
- Collision with buildings, fences, water, and blocked areas
- Generic interactable object system
- Farm plot Phaser visuals for empty, planted, growing, ready, regrowing, locked, and mutated states
- Server-authoritative stamina regeneration and action costs
- Global seed shop rotation with shared limited stock
- Seed inventory and fruit inventory
- Planting, watering, growth timers, ready state, harvesting, and regrowth cooldowns
- Mutation rolls: Normal, Big, Sweet, Golden, Crystal, Rainbow
- Sell-to-system fruit payouts with daily cap
- Marketplace listing, purchase settlement, cancellation, and fee logic
- Direct trade offers, item locking, confirmation reset on offer change, completion, cancellation, and expiry
- Read-only other-farm visits through `/api/farms/search` and `/api/farms/:userId`
- `$GROW` deposit and withdrawal paths with mock fallback
- Transaction logs, activity logs, profile, and leaderboard

## Assets

Placeholder pixel-art textures are generated in Phaser so the game remains playable without expensive art. Asset folders are prepared for replacement:

- `public/assets/tiles`
- `public/assets/characters`
- `public/assets/crops`
- `public/assets/ui`

The current placeholders can be swapped for real tilemaps, spritesheets, crop art, and UI images later without changing the React/API economy layer.

## Security Notes

- Gameplay rewards are validated server-side.
- Economic routes use Zod validation and authenticated user context.
- Critical balance, shop, inventory, marketplace, and trade updates use Prisma transactions.
- Fruit and `$GROW` offered in listings or trades are locked before settlement.
- Solana private keys are only read by server code.
- Use Redis or a managed limiter in production instead of the included in-memory MVP limiter.

## Current MVP Limitations

- No real-time multiplayer movement.
- Other farm visits are read-only.
- No NFT crops or land.
- No fertilizer item system yet.
- Shop rotations are generated lazily by API calls.
- Marketplace and trade updates use polling.
- Treasury signing is local-server MVP code and should be replaced before production custody.
- Marketplace prices and in-game `$GROW` balances use integer units.
