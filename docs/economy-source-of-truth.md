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
