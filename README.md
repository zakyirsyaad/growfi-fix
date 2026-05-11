# GrowFi

GrowFi is a Stardew Valley-inspired browser-based 2D farming GameFi. Players log in with Discord, connect a Solana wallet, enter a Phaser 3 top-down world, walk around their farm and town, buy seeds, plant and water crops, harvest mutated fruit, list or buy fruit in the marketplace, create direct trades, and move `$GROW` through an on-chain Solana economy.

GrowFi is being migrated to an on-chain-first architecture. The Anchor program in `anchor/programs/growfi_core` is the intended source of truth for gameplay economy and ownership: player profiles, farms, plots, seed/fruit inventories, shop stock, marketplace listings, trades, creator profiles, decoration ownership, and challenge reward claims. PostgreSQL/Prisma remains for Discord auth, metadata, indexing/cache, search, notifications, and legacy migration support.

## Tech Stack

- Next.js App Router + TypeScript
- Phaser 3 for the 2D top-down game canvas
- React overlays for inventory, shop, marketplace, trade, wallet, profile, and activity
- shadcn/ui + TailwindCSS for non-Phaser UI
- Prisma + PostgreSQL, Supabase-compatible
- NextAuth with Discord OAuth
- Solana wallet adapter, `@solana/web3.js`, `@solana/spl-token`
- Anchor smart contracts: `anchor/programs/growfi_core`
- Frontend Anchor client helpers: `lib/solana/growfiCore.ts`
- TanStack Query, Zustand, Zod

## On-Chain Architecture

On-chain source of truth:

- `$GROW` SPL token and treasury token vault
- Config PDA, player PDA, farm PDA, plot PDAs
- Seed and fruit inventory PDAs
- Seed catalog, shop rotation, shop item, and shop purchase PDAs
- Marketplace listing PDAs and direct trade PDAs
- Creator profile, decoration inventory, decoration placement, challenge, and challenge progress PDAs

Off-chain only:

- Discord OAuth session and username/avatar metadata
- Phaser rendering, movement, presence, chat, and socket notifications
- Asset metadata, event indexing/cache, search/filter UI, notification UI

The program uses SPL checked token transfers through `anchor-spl` token interface accounts. Economic actions such as `buy_seed`, `upgrade_farm`, `sell_fruit_to_system`, `buy_listing`, `complete_trade`, `tip_creator`, `buy_decoration`, and `claim_challenge_reward` are designed to move `$GROW` through token accounts rather than trusting client or Prisma balances.

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

GrowFi includes Socket.io realtime presence for public areas and shared farm rooms.

- Town uses room `town`, so everyone in TownScene can see remote player sprites and username labels.
- Home farms use room `home:{ownerId}`. A visitor joins the owner’s home room, so both players can see each other if they are in the same farm.
- Global chat uses `chat:global:*` events and keeps recent messages in memory on the realtime server.
- Visitors still cannot plant, water, harvest, or modify another player’s crops in the MVP.

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
TOKEN_CLUSTER=devnet
TOKEN_MODE=devnet
GROWFI_CORE_PROGRAM_ID=ESiJ1Fk5b9X8GitSjNW44LzRNBWByrHa7kkEWsTPmDYz
GROW_TOKEN_MINT=
GROW_TOKEN_DECIMALS=9
TREASURY_WALLET_PUBLIC_KEY=
TREASURY_TOKEN_ACCOUNT=
TREASURY_WALLET_SECRET_KEY=
MINT_AUTHORITY_SECRET_KEY=
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_TOKEN_CLUSTER=devnet
NEXT_PUBLIC_TOKEN_MODE=devnet
NEXT_PUBLIC_MOCK_TOKEN_MODE=false
NEXT_PUBLIC_GROWFI_CORE_PROGRAM_ID=ESiJ1Fk5b9X8GitSjNW44LzRNBWByrHa7kkEWsTPmDYz
NEXT_PUBLIC_GROW_TOKEN_MINT=
NEXT_PUBLIC_GROW_TOKEN_DECIMALS=9
NEXT_PUBLIC_TREASURY_WALLET_PUBLIC_KEY=
NEXT_PUBLIC_TREASURY_TOKEN_ACCOUNT=
```

Realtime settings:

```bash
NEXT_PUBLIC_REALTIME_URL=http://localhost:3000
REALTIME_PORT=3000
REALTIME_CORS_ORIGIN=http://localhost:3000
```

For production/staging, set `TOKEN_MODE` explicitly to `devnet` or `mainnet`; keep mock mode off unless you are running local demos. Never expose treasury secret keys to the frontend.

If you use ngrok, expose the unified Next.js app origin and set `NEXT_PUBLIC_REALTIME_URL` plus `REALTIME_CORS_ORIGIN` to that same origin.

## Anchor Program

Build the on-chain program:

```bash
npm run anchor:build
```

Run the Anchor test harness:

```bash
cd anchor
npm install
anchor test
```

Anchor CLI `1.0.x` uses Surfpool for its local validator path. If `anchor test` reports that `surfpool` is missing, install the Anchor toolchain dependency or run the IDL-only smoke suite while setting up the local validator:

```bash
anchor test --skip-build --skip-deploy --skip-local-validator
```

Deploy to devnet:

```bash
npm run anchor:deploy:devnet
```

The default Anchor provider expects `~/.config/solana/id.json`. To use another funded devnet wallet without committing a machine-specific path, pass it at deploy time:

```bash
cd anchor
anchor deploy --provider.cluster devnet --provider.wallet ~/.config/solana/<your-devnet-keypair>.json
```

Devnet setup outline:

1. Create or select a Solana keypair with devnet SOL.
2. Create the `$GROW` SPL mint.
3. Derive the `config` PDA from seed `["config"]`.
4. Create the treasury associated token account with the config PDA as token authority.
5. Deploy `growfi_core`.
6. Call `initialize_config` with the `$GROW` mint, treasury vault, and fee bps.
7. Seed the catalog with `create_seed_catalog`, then create rotations/items with `create_shop_rotation` and `create_shop_item`.
8. Point the frontend at `NEXT_PUBLIC_GROWFI_CORE_PROGRAM_ID`, `NEXT_PUBLIC_GROW_TOKEN_MINT`, and the devnet RPC URL.

## Run Locally

```bash
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:seed
npm run dev
```

`npm run dev` starts Next.js and Socket.io on the same `http://localhost:3000` server. `npm run dev:realtime` remains available only for a split-port fallback; set `REALTIME_PORT=3001` and `NEXT_PUBLIC_REALTIME_URL=http://localhost:3001` before using that mode.

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
