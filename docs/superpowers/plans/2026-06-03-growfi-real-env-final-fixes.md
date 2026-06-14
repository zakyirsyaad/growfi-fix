# GrowFi Real Env Final Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the remaining runtime blockers found after the real `.env` was added, so the next review can focus on product behavior instead of environment drift.

**Architecture:** Treat the deployed devnet program ID as the current source of truth, because the real `.env` points to it and devnet confirms it is executable and initialized. Keep wallet verification explicit, but make it mandatory before entering the game. Apply the pending Prisma migration to the configured Supabase database before testing wallet challenge/connect flows.

**Tech Stack:** Next.js 15, TypeScript, Prisma/Postgres, NextAuth, Solana Web3.js, Anchor, SPL Token, Upstash Redis.

---

## Current Confirmed Runtime Values

Use these public values only:

```txt
GROWFI_CORE_PROGRAM_ID=ESiJ1Fk5b9X8GitSjNW44LzRNBWByrHa7kkEWsTPmDYz
NEXT_PUBLIC_GROWFI_CORE_PROGRAM_ID=ESiJ1Fk5b9X8GitSjNW44LzRNBWByrHa7kkEWsTPmDYz
TREASURY_WALLET_PUBLIC_KEY=ExG9yviVVNeTBUcdjQ64hLhm5rmiQsr3iusiNc8Xzbmn
NEXT_PUBLIC_TREASURY_WALLET_PUBLIC_KEY=ExG9yviVVNeTBUcdjQ64hLhm5rmiQsr3iusiNc8Xzbmn
```

Do not print, commit, or document the Redis token or any private key.

## File Structure

- Modify `anchor/Anchor.toml`: align Anchor devnet/localnet program ID with the deployed devnet program.
- Modify `anchor/programs/growfi_core/src/lib.rs`: align `declare_id!` with the deployed devnet program.
- Modify `lib/idl/growfi_core.json`: align generated IDL address with the deployed devnet program.
- Modify `lib/solana/growfiCore.ts`: align app default program ID with the deployed devnet program.
- Modify `.env.example`: align public defaults with the deployed devnet program and treasury public key placeholders.
- Modify `README.md`: align setup docs with the same program ID.
- Modify `anchor/tests/growfi_core.ts`: add a smoke test that fails when program IDs drift again.
- Modify `components/game/WalletGate.tsx`: make backend wallet verification part of the `ready` gate and fix lint warnings.
- Modify `components/layout/AppShell.tsx`: remove unused wallet/session variables.
- Operational: apply Prisma migration `20260603120630_wallet_challenge` to the configured database.

---

### Task 1: Sync Program ID Across Source, IDL, and Docs

**Files:**
- Modify: `anchor/Anchor.toml`
- Modify: `anchor/programs/growfi_core/src/lib.rs`
- Modify: `lib/idl/growfi_core.json`
- Modify: `lib/solana/growfiCore.ts`
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `anchor/tests/growfi_core.ts`

- [ ] **Step 1: Replace the stale program ID everywhere**

Replace every active source/doc occurrence of:

```txt
3kuJMbz1mRpTiHzV3ajGN9d2Lk1gx78spe2Vi2TBTSEH
```

with:

```txt
ESiJ1Fk5b9X8GitSjNW44LzRNBWByrHa7kkEWsTPmDYz
```

Run:

```bash
rg -n "3kuJMbz1mRpTiHzV3ajGN9d2Lk1gx78spe2Vi2TBTSEH|ESiJ1Fk5b9X8GitSjNW44LzRNBWByrHa7kkEWsTPmDYz" \
  .env.example README.md lib/solana/growfiCore.ts lib/idl/growfi_core.json \
  anchor/Anchor.toml anchor/programs/growfi_core/src/lib.rs
```

Expected after the replacement: no `3kuJ...` result in these active files, and every program ID result is `ESiJ1...`.

- [ ] **Step 2: Add a drift-detection smoke test**

In `anchor/tests/growfi_core.ts`, keep the existing imports and add this constant/helper after the `idl` declaration:

```ts
const deployedProgramId = "ESiJ1Fk5b9X8GitSjNW44LzRNBWByrHa7kkEWsTPmDYz";
const repoRoot = new URL("../../", import.meta.url);

function readRepoFile(path: string) {
  return fs.readFileSync(new URL(path, repoRoot), "utf8");
}
```

Then add this test as the first `it(...)` inside `describe("growfi_core IDL smoke tests", () => {`:

```ts
  it("keeps program ids in sync with the deployed devnet program", () => {
    expect(idl.address).to.equal(deployedProgramId);
    expect(readRepoFile("lib/solana/growfiCore.ts")).to.contain(`"${deployedProgramId}"`);
    expect(readRepoFile("anchor/Anchor.toml")).to.contain(`growfi_core = "${deployedProgramId}"`);
    expect(readRepoFile("anchor/programs/growfi_core/src/lib.rs")).to.contain(
      `declare_id!("${deployedProgramId}")`
    );
  });
```

- [ ] **Step 3: Run the Anchor smoke test**

Run:

```bash
cd anchor && npm exec -- ts-mocha -p ./tsconfig.json -t 1000000 "tests/**/*.ts"
```

Expected:

```txt
4 passing
12 pending
```

- [ ] **Step 4: Commit Task 1**

```bash
git add anchor/Anchor.toml anchor/programs/growfi_core/src/lib.rs lib/idl/growfi_core.json lib/solana/growfiCore.ts .env.example README.md anchor/tests/growfi_core.ts
git commit -m "fix: sync growfi program id with deployed devnet"
```

---

### Task 2: Make Wallet Verification Required Before Entering Game

**Files:**
- Modify: `components/game/WalletGate.tsx`
- Modify: `components/layout/AppShell.tsx`

- [ ] **Step 1: Remove unused imports/variables in `WalletGate`**

Change the React import in `components/game/WalletGate.tsx` from:

```ts
import { ReactNode, useEffect, useMemo, useState, useRef } from "react";
```

to:

```ts
import { ReactNode, useEffect, useMemo, useState } from "react";
```

Change:

```ts
  const { data: session, status } = useSession();
```

to:

```ts
  const { status } = useSession();
```

- [ ] **Step 2: Move `walletVerified` before `ready` and require it**

In `components/game/WalletGate.tsx`, replace the block from `const walletAddress = ...` through `const ready = ...` with:

```ts
  const walletAddress = wallet.publicKey?.toBase58();
  const walletVerified =
    !!wallet.publicKey &&
    !!walletAddress &&
    meQuery.data?.user.walletAddress === walletAddress;
  const solBalance = balances.data?.sol ?? 0;
  const growBalance = balances.data?.grow?.balance ?? 0;
  const hasDevnetSol = solBalance >= MINIMUM_DEVNET_SOL;
  const hasGrow = !!mintAddress && growBalance > 0;
  const devnetConfigured = isDevnetConfigured();
  const ready =
    status === "authenticated" &&
    !!wallet.publicKey &&
    walletVerified &&
    devnetConfigured &&
    !!onchain.data?.config &&
    hasDevnetSol &&
    hasGrow &&
    !!onchain.data?.player &&
    !!onchain.data?.farm;
```

Remove the old duplicate `const walletVerified = ...` block that currently appears after the `useEffect`.

- [ ] **Step 3: Fix `useMemo` dependencies**

In the `steps = useMemo(...)` dependency array, add `walletVerified`.

The final dependency array should include:

```ts
    [
      hasDevnetSol,
      hasGrow,
      onchain.data?.farm,
      onchain.data?.player,
      ready,
      status,
      wallet.publicKey,
      walletVerified,
    ]
```

- [ ] **Step 4: Remove unused variables in `AppShell`**

In `components/layout/AppShell.tsx`, replace:

```ts
  const { data: session, status } = useSession();
  const wallet = useWallet();
  const { publicKey, connected } = wallet;
```

with:

```ts
  const { status } = useSession();
```

If `useWallet` is no longer used anywhere in `AppShell`, remove it from the import list at the top of the file.

- [ ] **Step 5: Run lint**

Run:

```bash
pnpm lint
```

Expected: exits `0` with no warnings for `WalletGate.tsx` or `AppShell.tsx`.

- [ ] **Step 6: Commit Task 2**

```bash
git add components/game/WalletGate.tsx components/layout/AppShell.tsx
git commit -m "fix: require verified wallet before game entry"
```

---

### Task 3: Apply the Pending Wallet Challenge Migration

**Files:**
- No source file changes expected.
- Database operation: configured Supabase/Postgres from `.env`.

- [ ] **Step 1: Confirm `.env` targets the intended database**

Run:

```bash
pnpm prisma migrate status
```

Expected before deploy:

```txt
Following migration have not yet been applied:
20260603120630_wallet_challenge
```

If the output shows a different database host than the intended Supabase project, stop and fix `.env` before continuing.

- [ ] **Step 2: Apply the migration**

Run this only once against the intended production/devnet database:

```bash
pnpm prisma migrate deploy
```

Expected:

```txt
Applying migration `20260603120630_wallet_challenge`
The following migration(s) have been applied:
20260603120630_wallet_challenge
```

- [ ] **Step 3: Confirm database is up to date**

Run:

```bash
pnpm prisma migrate status
```

Expected:

```txt
Database schema is up to date!
```

- [ ] **Step 4: Commit Task 3 only if Prisma generated tracked changes**

Run:

```bash
git status --short
```

Expected: no new source changes from this task. If Prisma generated a tracked schema/client change, inspect it first before committing. Do not commit `.env`.

---

### Task 4: Final Verification Bundle

**Files:**
- No new source file changes expected unless a verification command exposes a real issue.

- [ ] **Step 1: Confirm `.env` is still ignored**

Run:

```bash
git check-ignore -v .env
```

Expected:

```txt
.gitignore:1:.env	.env
```

- [ ] **Step 2: Confirm required runtime env is present without printing secrets**

Run:

```bash
node <<'NODE'
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());
const required = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'GROWFI_CORE_PROGRAM_ID',
  'NEXT_PUBLIC_GROWFI_CORE_PROGRAM_ID',
  'GROW_TOKEN_MINT',
  'NEXT_PUBLIC_GROW_TOKEN_MINT',
  'TREASURY_WALLET_PUBLIC_KEY',
  'NEXT_PUBLIC_TREASURY_WALLET_PUBLIC_KEY',
  'TREASURY_WALLET_SECRET_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN'
];
const missing = required.filter((key) => !process.env[key]);
console.log('missing=' + (missing.join(',') || 'none'));
console.log('program=' + process.env.GROWFI_CORE_PROGRAM_ID);
console.log('treasuryPublic=' + process.env.TREASURY_WALLET_PUBLIC_KEY);
console.log('redisConfigured=' + Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN));
NODE
```

Expected:

```txt
missing=none
program=ESiJ1Fk5b9X8GitSjNW44LzRNBWByrHa7kkEWsTPmDYz
treasuryPublic=ExG9yviVVNeTBUcdjQ64hLhm5rmiQsr3iusiNc8Xzbmn
redisConfigured=true
```

- [ ] **Step 3: Confirm Upstash responds without printing the token**

Run:

```bash
node <<'NODE'
const { loadEnvConfig } = require('@next/env');
const { Redis } = require('@upstash/redis');
loadEnvConfig(process.cwd());
(async () => {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN
  });
  console.log('upstash.ping=' + await redis.ping());
})().catch((error) => {
  console.error('upstash.ping.failed=' + error.message);
  process.exit(1);
});
NODE
```

Expected:

```txt
upstash.ping=PONG
```

- [ ] **Step 4: Run app verification**

Run:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all commands exit `0`.

- [ ] **Step 5: Run Anchor smoke verification**

Run:

```bash
cd anchor && npm exec -- ts-mocha -p ./tsconfig.json -t 1000000 "tests/**/*.ts"
```

Expected:

```txt
4 passing
12 pending
```

- [ ] **Step 6: Check full Anchor build separately**

Run:

```bash
pnpm anchor:build
```

Expected if Solana/Anchor SBF toolchain is installed:

```txt
Finished release
```

Known local fallback: if it fails with `error: no such command: build-sbf`, record it as a local toolchain blocker and do not treat it as an app regression.

- [ ] **Step 7: Final worktree hygiene**

Run:

```bash
git status --short
git diff --check
```

Expected:

```txt
git diff --check
```

exits `0`.

Review `anchor/package-lock.json` if it remains modified. Keep it only if a package change was intentional; otherwise restore it before the final handoff.

---

## Handoff Notes for Review

When implementation is finished, provide these results before asking for another review:

```txt
pnpm typecheck: PASS/FAIL
pnpm lint: PASS/FAIL
pnpm build: PASS/FAIL
anchor smoke test: PASS/FAIL
pnpm prisma migrate status: up to date / pending
Upstash ping: PONG / failed
program ID sync rg: no stale 3kuJ result / stale result exists
```

Do not paste `.env`, Redis token, wallet secret key, mint authority secret key, or admin secret key.
