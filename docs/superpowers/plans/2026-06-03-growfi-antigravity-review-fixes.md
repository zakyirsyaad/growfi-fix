# GrowFi Antigravity Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the regressions found after the Antigravity implementation: broken wallet-connect callers, missing Prisma migration, fake Anchor tests, inconsistent mock token flow, and Anchor verification blockers.

**Architecture:** Keep the new wallet signature model, but centralize the client-side challenge/signature flow so every caller uses the same verified path. Keep mock token mode explicit across client and server. Treat Anchor tests as real transaction tests or clearly label them as IDL smoke tests until the local SBF toolchain is fixed.

**Tech Stack:** Next.js App Router, TypeScript, Prisma/PostgreSQL, NextAuth, Solana Wallet Adapter, `bs58`, `tweetnacl`, Anchor, pnpm.

---

## Review Findings To Fix

- `components/layout/AppShell.tsx` still calls `/api/wallet/connect` with only `{ walletAddress }`, but the endpoint now requires `{ walletAddress, message, signature }`.
- `prisma/schema.prisma` added `walletChallengeNonce` and `walletChallengeExpiresAt`, but no Prisma migration was created.
- `anchor/tests/growfi_core.ts` replaced skipped tests with `expect(true).to.be.true`, so behavior is not actually tested.
- `components/wallet/WalletDashboard.tsx` still generates `mock-deposit-*` when client token config is missing, while the server now only accepts mock when `TOKEN_MODE=mock`.
- `pnpm anchor:build` fails because `anchor/target/deploy/growfi_core-keypair.json` does not match `declare_id!`.
- `pnpm anchor:test` fails because the local environment lacks `cargo build-sbf`.

---

## Task 1: Create Prisma Migration For Wallet Challenge Fields

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_wallet_challenge/migration.sql`

- [ ] **Step 1: Confirm schema fields exist**

Verify `model User` contains:

```prisma
  walletChallengeNonce     String?
  walletChallengeExpiresAt DateTime?
```

- [ ] **Step 2: Create migration from current schema**

Run:

```bash
pnpm prisma migrate dev --name wallet_challenge
```

Expected: Prisma creates a new folder under `prisma/migrations`.

- [ ] **Step 3: Check migration SQL**

The new migration should contain:

```sql
ALTER TABLE "User" ADD COLUMN "walletChallengeNonce" TEXT;
ALTER TABLE "User" ADD COLUMN "walletChallengeExpiresAt" TIMESTAMP(3);
```

- [ ] **Step 4: Verify Prisma client**

Run:

```bash
pnpm prisma generate
pnpm typecheck
```

Expected: both commands pass.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "fix: add wallet challenge migration"
```

---

## Task 2: Centralize Verified Wallet Connect Flow

**Files:**
- Create: `lib/solana/verifiedWalletConnect.ts`
- Modify: `components/game/WalletGate.tsx`
- Modify: `components/layout/AppShell.tsx`
- Check: `components/wallet/WalletDashboard.tsx`

- [ ] **Step 1: Create shared client helper**

Create `lib/solana/verifiedWalletConnect.ts`:

```ts
"use client";

import bs58 from "bs58";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { apiFetch } from "@/lib/utils/fetcher";

type WalletChallengeResponse = {
  message: string;
  walletAddress: string;
};

export async function connectVerifiedWallet(wallet: WalletContextState) {
  const walletAddress = wallet.publicKey?.toBase58();
  if (!walletAddress) {
    throw new Error("Connect a Solana wallet first.");
  }
  if (!wallet.signMessage) {
    throw new Error("This wallet does not support message signing.");
  }

  const challenge = await apiFetch<WalletChallengeResponse>(
    "/api/wallet/challenge",
    {
      method: "POST",
      body: JSON.stringify({ walletAddress }),
    }
  );

  const signatureBytes = await wallet.signMessage(
    new TextEncoder().encode(challenge.message)
  );

  return apiFetch("/api/wallet/connect", {
    method: "POST",
    body: JSON.stringify({
      walletAddress: challenge.walletAddress,
      message: challenge.message,
      signature: bs58.encode(signatureBytes),
    }),
  });
}
```

- [ ] **Step 2: Update `WalletGate` to use shared helper**

In `components/game/WalletGate.tsx`, remove direct `bs58` import and use:

```ts
import { connectVerifiedWallet } from "@/lib/solana/verifiedWalletConnect";
```

Replace the body of `connectWithSignature` with:

```ts
await connectVerifiedWallet(wallet);
await queryClient.invalidateQueries({ queryKey: ["me"] });
```

- [ ] **Step 3: Update `AppShell` to use shared helper**

In `components/layout/AppShell.tsx`, replace the current `/api/wallet/connect` call:

```ts
apiFetch("/api/wallet/connect", {
  method: "POST",
  body: JSON.stringify({ walletAddress: publicKey.toBase58() })
}).catch(() => undefined);
```

with:

```ts
connectVerifiedWallet(wallet).catch(() => undefined);
```

Adjust the wallet hook so `AppShell` has access to the full wallet object:

```ts
const wallet = useWallet();
const { publicKey, connected } = wallet;
```

Add import:

```ts
import { connectVerifiedWallet } from "@/lib/solana/verifiedWalletConnect";
```

- [ ] **Step 4: Avoid repeated signature popups**

Add a guard so wallet verification is skipped when the backend already has the same wallet. Use `/api/me` or session-backed query if available in the component. Minimum acceptable guard:

```ts
const verifiedWalletRef = useRef<string | null>(null);

if (verifiedWalletRef.current === walletAddress) {
  return;
}

await connectVerifiedWallet(wallet);
verifiedWalletRef.current = walletAddress;
```

Apply this guard in `WalletGate` and `AppShell`.

- [ ] **Step 5: Verify no legacy connect call remains**

Run:

```bash
rg '"/api/wallet/connect"|/api/wallet/connect' components app lib
```

Expected: only the shared helper calls `/api/wallet/connect`.

- [ ] **Step 6: Verify**

Run:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all pass.

- [ ] **Step 7: Manual test**

1. Login with Discord.
2. Connect wallet on `/game`.
3. Confirm signature prompt appears once.
4. Refresh page.
5. Confirm signature prompt does not loop.
6. Open `/wallet`.
7. Confirm backend wallet remains attached.

- [ ] **Step 8: Commit**

```bash
git add lib/solana/verifiedWalletConnect.ts components/game/WalletGate.tsx components/layout/AppShell.tsx
git commit -m "fix: use verified wallet connect everywhere"
```

---

## Task 3: Align Client Mock Deposit With Server Token Mode

**Files:**
- Modify: `lib/solana/client.ts`
- Modify: `components/wallet/WalletDashboard.tsx`
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Replace public mock flag logic**

In `lib/solana/client.ts`, replace `hasClientTokenConfig` with:

```ts
export function isClientMockTokenMode() {
  return process.env.NEXT_PUBLIC_TOKEN_MODE === "mock";
}

export function hasClientTokenConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_GROW_TOKEN_MINT &&
      process.env.NEXT_PUBLIC_TREASURY_WALLET_PUBLIC_KEY &&
      !isClientMockTokenMode()
  );
}
```

- [ ] **Step 2: Stop auto-falling back to mock deposits in devnet**

In `components/wallet/WalletDashboard.tsx`, change deposit logic:

```ts
let signature = `mock-deposit-${Date.now()}`;
if (hasClientTokenConfig()) {
  // real token transfer
}
```

to:

```ts
let signature: string;
if (isClientMockTokenMode()) {
  signature = `mock-deposit-${Date.now()}`;
} else {
  if (!hasClientTokenConfig()) {
    throw new Error("Token mint and treasury wallet are required for devnet deposits.");
  }
  toast.loading("Preparing deposit", {
    id: "wallet-deposit",
    description: "Waiting for wallet approval.",
  });
  const transaction = await buildDepositTransaction({
    connection,
    wallet: wallet.publicKey,
    amount: depositAmount,
  });
  signature = await wallet.sendTransaction(transaction, connection);
  toast.loading("Confirming deposit", {
    id: "wallet-deposit",
    description: shortAddress(signature),
  });
  await connection.confirmTransaction(signature, "confirmed");
}
```

Also update import:

```ts
import {
  buildDepositTransaction,
  hasClientTokenConfig,
  isClientMockTokenMode,
} from "@/lib/solana/client";
```

- [ ] **Step 3: Update mock badge**

Replace:

```ts
const mockMode =
  process.env.NEXT_PUBLIC_MOCK_TOKEN_MODE === "true" ||
  !process.env.NEXT_PUBLIC_GROW_TOKEN_MINT;
```

with:

```ts
const mockMode = isClientMockTokenMode();
```

- [ ] **Step 4: Update env docs**

In `.env.example`, remove or de-emphasize `NEXT_PUBLIC_MOCK_TOKEN_MODE`. Prefer:

```bash
TOKEN_MODE=devnet
NEXT_PUBLIC_TOKEN_MODE=devnet
# Use TOKEN_MODE=mock and NEXT_PUBLIC_TOKEN_MODE=mock only for local demos.
```

- [ ] **Step 5: Verify**

Run:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add lib/solana/client.ts components/wallet/WalletDashboard.tsx .env.example README.md
git commit -m "fix: align client token mock mode"
```

---

## Task 4: Replace Fake Anchor Tests With Honest Smoke Tests Or Real Tests

**Files:**
- Modify: `anchor/tests/growfi_core.ts`
- Modify: `anchor/tests/helpers.ts`
- Modify: `README.md`

- [ ] **Step 1: Remove fake integration blocks**

Delete all tests that only contain:

```ts
expect(true).to.be.true;
```

This includes the current fake setup and economy abuse tests.

- [ ] **Step 2: Rename suite to IDL smoke tests if no local validator test is implemented**

Keep the existing IDL assertions, but name the suite honestly:

```ts
describe("growfi_core IDL smoke tests", () => {
```

- [ ] **Step 3: Add explicit pending test list without passing falsely**

Use `it.skip` with clear reason, or document the missing SBF/validator blocker in README. Do not use passing fake tests.

Example:

```ts
it.skip("integration: initialize config", () => {
  // Requires Solana SBF toolchain and a local validator fixture.
});
```

- [ ] **Step 4: Add README note for Anchor blocker**

Under Anchor Program docs, add:

```md
Current local Anchor integration tests require the Solana SBF toolchain. If `anchor test` fails with `no such command: build-sbf`, install the Solana toolchain before treating Anchor tests as verified.
```

- [ ] **Step 5: Verify IDL smoke suite only**

Run from `anchor` after installing anchor dependencies:

```bash
cd anchor
npm install
npx ts-mocha -p ./tsconfig.json -t 1000000 "tests/**/*.ts"
```

Expected: IDL smoke tests pass. Skipped integration tests must remain skipped, not fake-passing.

- [ ] **Step 6: Commit**

```bash
git add anchor/tests/growfi_core.ts anchor/tests/helpers.ts README.md anchor/package-lock.json
git commit -m "test: remove fake anchor integration coverage"
```

---

## Task 5: Fix Anchor Program ID Build Blocker

**Files:**
- Modify or regenerate: `anchor/target/deploy/growfi_core-keypair.json`
- Check: `anchor/Anchor.toml`
- Check: `anchor/programs/growfi_core/src/lib.rs`

- [ ] **Step 1: Confirm current mismatch**

Run:

```bash
pnpm anchor:build
```

Expected current failure:

```text
Program ID mismatch detected for program 'growfi_core'
```

- [ ] **Step 2: Choose correct program ID**

The source and `Anchor.toml` currently use:

```text
ESiJ1Fk5b9X8GitSjNW44LzRNBWByrHa7kkEWsTPmDYz
```

Keep this ID if it is the deployed devnet program.

- [ ] **Step 3: Restore matching keypair**

If this program ID is already deployed, restore the matching keypair from your secure key storage into:

```text
anchor/target/deploy/growfi_core-keypair.json
```

If this is only local development and no deployed program must be preserved, run:

```bash
cd anchor
anchor keys sync
```

Then update env/docs if the program ID changes.

- [ ] **Step 4: Pin Anchor toolchain version**

In `anchor/Anchor.toml`, add:

```toml
[toolchain]
anchor_version = "1.0.2"
package_manager = "npm"
```

If `[toolchain]` already exists, add only `anchor_version = "1.0.2"` under it.

- [ ] **Step 5: Verify build**

Run:

```bash
pnpm anchor:build
```

Expected: build passes or fails only because Solana SBF toolchain is missing. Do not claim Anchor build passed if program ID mismatch remains.

- [ ] **Step 6: Commit**

```bash
git add anchor/Anchor.toml anchor/target/deploy/growfi_core-keypair.json README.md
git commit -m "fix: align anchor program id tooling"
```

---

## Final Verification

Run:

```bash
pnpm prisma generate
pnpm typecheck
pnpm lint
pnpm build
rg '"/api/wallet/connect"|/api/wallet/connect' components app lib
```

Expected:

- Prisma generate passes.
- Typecheck passes.
- Lint passes.
- Build passes.
- Only `lib/solana/verifiedWalletConnect.ts` calls `/api/wallet/connect`.

Run Anchor checks:

```bash
pnpm anchor:build
pnpm anchor:test
```

Expected:

- If the SBF toolchain is installed, both pass.
- If SBF is missing, document the blocker clearly and do not mark Anchor verification as complete.

Manual wallet test:

1. Login with Discord.
2. Connect wallet.
3. Sign exactly one wallet verification message.
4. Confirm `/api/me` returns the connected wallet.
5. Open `/wallet`.
6. Deposit in `devnet` mode only when token mint and treasury public env are configured.
7. Confirm mock deposit is only possible when both server and client token modes are `mock`.

