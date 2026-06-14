# GrowFi Second Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the remaining regressions from the second review: inconsistent Anchor program IDs, automatic wallet signature popups, non-runnable Anchor smoke tests, and a typecheck script that depends on stale/generated `.next/types`.

**Architecture:** Keep the current verified-wallet and explicit-token-mode design, but make all source-of-truth values deterministic and consistent. Program ID must come from one chosen value across Anchor source, IDL, docs, env examples, and frontend defaults. Wallet verification should be explicit or skipped when the backend already has the same wallet. Verification commands must work from a clean checkout or clearly document required toolchain blockers.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, NextAuth, Solana Wallet Adapter, Anchor, pnpm, Mocha/Chai.

---

## Current Review Findings

- `anchor/programs/growfi_core/src/lib.rs` and `.env.example` now use program ID `3kuJMbz1mRpTiHzV3ajGN9d2Lk1gx78spe2Vi2TBTSEH`.
- `README.md`, `lib/solana/growfiCore.ts`, and `lib/idl/growfi_core.json` still use program ID `ESiJ1Fk5b9X8GitSjNW44LzRNBWByrHa7kkEWsTPmDYz`.
- `components/layout/AppShell.tsx` and `components/game/WalletGate.tsx` still call wallet signature verification automatically when a wallet is connected.
- `anchor/tests/growfi_core.ts` imports `../target/idl/growfi_core.json`, but `target/idl` does not exist when `anchor build` fails due to missing SBF toolchain.
- `pnpm typecheck` fails before `pnpm build` because `tsconfig.json` includes `.next/types/**/*.ts`.
- `pnpm anchor:build` still fails on the current machine with `no such command: build-sbf`.
- Worktree had uncommitted changes in `README.md`, `anchor/package-lock.json`, and `anchor/tests/growfi_core.ts`; finish or revert intentional changes before final commit.

---

## Task 1: Choose And Sync The Single GrowFi Program ID

**Files:**
- Modify: `anchor/Anchor.toml`
- Modify: `anchor/programs/growfi_core/src/lib.rs`
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `lib/solana/growfiCore.ts`
- Modify: `lib/idl/growfi_core.json`

- [ ] **Step 1: Choose the correct program ID**

Pick one value and apply it everywhere.

If the active deployed devnet program is the old one, use:

```text
ESiJ1Fk5b9X8GitSjNW44LzRNBWByrHa7kkEWsTPmDYz
```

If the local keypair in `anchor/target/deploy/growfi_core-keypair.json` is intentionally the new program, use:

```text
3kuJMbz1mRpTiHzV3ajGN9d2Lk1gx78spe2Vi2TBTSEH
```

Do not keep mixed IDs.

- [ ] **Step 2: Sync Anchor source**

In `anchor/programs/growfi_core/src/lib.rs`, set:

```rust
declare_id!("CHOSEN_PROGRAM_ID");
```

- [ ] **Step 3: Sync Anchor config**

In `anchor/Anchor.toml`, make both devnet and localnet match the same chosen ID unless there is a documented reason not to:

```toml
[programs.localnet]
growfi_core = "CHOSEN_PROGRAM_ID"

[programs.devnet]
growfi_core = "CHOSEN_PROGRAM_ID"
```

Keep:

```toml
[toolchain]
anchor_version = "1.0.2"
package_manager = "npm"
```

- [ ] **Step 4: Sync frontend default**

In `lib/solana/growfiCore.ts`, set:

```ts
export const DEFAULT_GROWFI_CORE_PROGRAM_ID =
  "CHOSEN_PROGRAM_ID";
```

- [ ] **Step 5: Sync committed IDL address**

In `lib/idl/growfi_core.json`, set the top-level address:

```json
{
  "address": "CHOSEN_PROGRAM_ID"
}
```

Only update the address manually if the instruction/account schema did not change. If Anchor build succeeds later, replace this file with the generated IDL.

- [ ] **Step 6: Sync env examples and README**

In `.env.example` and `README.md`, set:

```bash
GROWFI_CORE_PROGRAM_ID=CHOSEN_PROGRAM_ID
NEXT_PUBLIC_GROWFI_CORE_PROGRAM_ID=CHOSEN_PROGRAM_ID
```

- [ ] **Step 7: Verify no mixed IDs remain**

Run:

```bash
rg "ESiJ1Fk5b9X8GitSjNW44LzRNBWByrHa7kkEWsTPmDYz|3kuJMbz1mRpTiHzV3ajGN9d2Lk1gx78spe2Vi2TBTSEH" -g '!node_modules' -g '!anchor/target'
```

Expected: every result uses only the chosen ID, except old plan docs under `docs/superpowers/plans` if you decide to keep historical plans untouched.

- [ ] **Step 8: Commit**

```bash
git add anchor/Anchor.toml anchor/programs/growfi_core/src/lib.rs .env.example README.md lib/solana/growfiCore.ts lib/idl/growfi_core.json
git commit -m "fix: sync growfi program id across app"
```

---

## Task 2: Stop Automatic Wallet Signature Popups

**Files:**
- Modify: `lib/solana/verifiedWalletConnect.ts`
- Modify: `components/layout/AppShell.tsx`
- Modify: `components/game/WalletGate.tsx`
- Modify: `components/wallet/WalletDashboard.tsx` if adding a shared UI control

- [ ] **Step 1: Extend helper return type**

In `lib/solana/verifiedWalletConnect.ts`, make the return type explicit:

```ts
type WalletConnectResponse = {
  user: {
    id: string;
    walletAddress?: string | null;
  };
};
```

Update the return call:

```ts
return apiFetch<WalletConnectResponse>("/api/wallet/connect", {
  method: "POST",
  body: JSON.stringify({
    walletAddress: challenge.walletAddress,
    message: challenge.message,
    signature: bs58.encode(signatureBytes),
  }),
});
```

- [ ] **Step 2: Remove automatic verification from `AppShell`**

In `components/layout/AppShell.tsx`, remove the `useEffect` that calls `connectVerifiedWallet`.

`AppShell` should not trigger wallet signature popups. It can display `WalletMultiButton`, but verification should happen in a controlled onboarding gate or wallet dashboard action.

Remove unused imports:

```ts
useEffect
useRef
WalletContextState
connectVerifiedWallet
```

- [ ] **Step 3: Convert `WalletGate` verification to explicit action**

In `components/game/WalletGate.tsx`, remove the automatic `useEffect` that calls `connectVerifiedWallet`.

Add a mutation:

```ts
const verifyWalletMutation = useMutation({
  mutationFn: () => connectVerifiedWallet(wallet),
  onSuccess: async () => {
    toast.success("Wallet verified");
    await queryClient.invalidateQueries({ queryKey: ["me"] });
  },
  onError: (error) => {
    toast.error("Wallet verification failed", {
      description:
        error instanceof Error ? error.message : "Please try again.",
    });
  },
});
```

- [ ] **Step 4: Add a visible verify button in the setup gate**

In the `WalletGate` setup UI where wallet connection status is shown, add:

```tsx
<Button
  disabled={!wallet.publicKey || verifyWalletMutation.isPending}
  onClick={() => verifyWalletMutation.mutate()}
>
  {verifyWalletMutation.isPending ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : (
    <Wallet className="h-4 w-4" />
  )}
  Verify wallet
</Button>
```

Place it after `WalletMultiButton` or near the wallet setup step.

- [ ] **Step 5: Skip verification if backend already has same wallet**

Fetch `/api/me` in `WalletGate` or rely on existing query data if available. If `me.user.walletAddress === wallet.publicKey.toBase58()`, render the wallet step as complete and do not show the verify button as required.

Expected guard:

```ts
const walletVerified =
  !!wallet.publicKey &&
  me?.user.walletAddress === wallet.publicKey.toBase58();
```

- [ ] **Step 6: Verify no automatic helper calls remain**

Run:

```bash
rg "connectVerifiedWallet\\(" components app lib
```

Expected: calls are inside explicit button/mutation handlers, not mount-time `useEffect`.

- [ ] **Step 7: Verify**

Run:

```bash
pnpm lint
pnpm build
pnpm typecheck
```

Expected: all pass after build has generated `.next/types`.

- [ ] **Step 8: Manual test**

1. Login with Discord.
2. Connect wallet.
3. Confirm no signature popup appears automatically.
4. Click `Verify wallet`.
5. Confirm one signature popup appears.
6. Verify `/api/me` returns the connected wallet.
7. Refresh page.
8. Confirm no new signature popup appears if the wallet is already verified.

- [ ] **Step 9: Commit**

```bash
git add lib/solana/verifiedWalletConnect.ts components/layout/AppShell.tsx components/game/WalletGate.tsx components/wallet/WalletDashboard.tsx
git commit -m "fix: make wallet verification explicit"
```

---

## Task 3: Make Anchor Smoke Tests Runnable Without SBF Build

**Files:**
- Modify: `anchor/tests/growfi_core.ts`
- Optional modify: `anchor/tests/helpers.ts`
- Modify: `README.md`

- [ ] **Step 1: Import committed IDL instead of generated target IDL**

In `anchor/tests/growfi_core.ts`, replace:

```ts
import idl from "../target/idl/growfi_core.json";
```

with:

```ts
import idl from "../../lib/idl/growfi_core.json";
```

This lets the IDL smoke suite run even when `anchor build` cannot generate `anchor/target/idl`.

- [ ] **Step 2: Keep integration tests skipped honestly**

Keep skipped integration tests like:

```ts
it.skip("initialize config", () => {
  // Requires Solana SBF toolchain and a local validator fixture.
});
```

Do not use `expect(true).to.be.true`.

- [ ] **Step 3: Verify smoke suite**

Run:

```bash
cd anchor
npm install
npm exec -- ts-mocha -p ./tsconfig.json -t 1000000 "tests/**/*.ts"
```

Expected:

```text
3 passing
12 pending
```

The exact number of pending tests can differ if more skipped integration tests exist, but there must be no fake-passing integration tests.

- [ ] **Step 4: Document the split**

In `README.md`, under Anchor Program, add:

```md
The committed IDL smoke suite can run without the SBF build toolchain:

```bash
cd anchor
npm exec -- ts-mocha -p ./tsconfig.json -t 1000000 "tests/**/*.ts"
```

Full integration tests still require the Solana SBF toolchain and local validator support.
```
```

- [ ] **Step 5: Commit**

```bash
git add anchor/tests/growfi_core.ts anchor/tests/helpers.ts README.md anchor/package-lock.json
git commit -m "test: make anchor idl smoke tests runnable"
```

---

## Task 4: Make Typecheck Work From A Clean Checkout

**Files:**
- Modify: `package.json`
- Optional modify: `tsconfig.json`

- [ ] **Step 1: Confirm current failure**

From a clean state without `.next/types`, run:

```bash
rm -rf .next
pnpm typecheck
```

Expected current failure:

```text
error TS6053: File '.next/types/...' not found.
```

- [ ] **Step 2: Add a Next typegen script**

Check whether Next supports typegen in this version:

```bash
pnpm exec next typegen --help
```

If it works, update `package.json`:

```json
{
  "scripts": {
    "typegen": "next typegen",
    "typecheck": "pnpm typegen && tsc --noEmit"
  }
}
```

- [ ] **Step 3: Use fallback if `next typegen` is unavailable**

If `next typegen` is not available, use:

```json
{
  "scripts": {
    "typecheck": "next build --no-lint && tsc --noEmit"
  }
}
```

Only use this fallback if the build command is acceptable for CI runtime.

- [ ] **Step 4: Verify from clean state**

Run:

```bash
rm -rf .next
pnpm typecheck
```

Expected: pass.

- [ ] **Step 5: Verify normal checks**

Run:

```bash
pnpm lint
pnpm build
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json
git commit -m "fix: make typecheck generate next types"
```

---

## Task 5: Keep Anchor Build Blocker Explicit

**Files:**
- Modify: `README.md`
- Do not fake-pass: `anchor/tests/growfi_core.ts`

- [ ] **Step 1: Keep `anchor:build` failure documented**

Since current machine returns:

```text
error: no such command: `build-sbf`
```

README must state:

```md
`pnpm anchor:build` and `pnpm anchor:test` require the Solana SBF build toolchain. If `cargo build-sbf` is unavailable, the contract build is not verified.
```

- [ ] **Step 2: Do not mark Anchor as fully verified**

In any release note, walkthrough, or PR summary, use:

```text
Anchor IDL smoke tests pass. Full Anchor build/test is blocked locally by missing cargo build-sbf.
```

Do not write:

```text
Anchor tests pass
```

unless `pnpm anchor:build` and `pnpm anchor:test` both pass.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: clarify anchor sbf build requirement"
```

---

## Final Verification Checklist

Run from repo root:

```bash
pnpm prisma generate
rm -rf .next
pnpm typecheck
pnpm lint
pnpm build
rg '"/api/wallet/connect"|/api/wallet/connect' components app lib
rg "connectVerifiedWallet\\(" components app lib
rg "ESiJ1Fk5b9X8GitSjNW44LzRNBWByrHa7kkEWsTPmDYz|3kuJMbz1mRpTiHzV3ajGN9d2Lk1gx78spe2Vi2TBTSEH" -g '!node_modules' -g '!anchor/target'
```

Expected:

- Prisma generate passes.
- Typecheck passes after removing `.next`.
- Lint passes.
- Build passes.
- Only `lib/solana/verifiedWalletConnect.ts` posts to `/api/wallet/connect`.
- `connectVerifiedWallet` is only called from explicit user actions.
- Only one chosen program ID appears in active source/docs/env files.

Run Anchor smoke tests:

```bash
cd anchor
npm install
npm exec -- ts-mocha -p ./tsconfig.json -t 1000000 "tests/**/*.ts"
```

Expected:

- IDL smoke tests pass.
- Integration tests remain skipped until SBF/local-validator fixture is implemented.

Run full Anchor checks only when SBF toolchain exists:

```bash
pnpm anchor:build
pnpm anchor:test
```

Expected:

- If `cargo build-sbf` exists, both should pass.
- If `cargo build-sbf` is missing, report this as a local toolchain blocker.

Final git check:

```bash
git status --short --branch
```

Expected:

- No accidental uncommitted changes except intentionally untracked planning docs.

