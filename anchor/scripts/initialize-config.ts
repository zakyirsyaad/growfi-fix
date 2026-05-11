import * as anchor from "@coral-xyz/anchor";

import {
  configPda,
  decodeAnchorError,
  ensureAssociatedTokenAccount,
  fetchNullable,
  formatExplorer,
  getMintTokenProgram,
  loadProgram,
  loadProgramId,
  loadProvider,
  parseIntegerEnv,
  printPda,
} from "./growfi-devnet-utils";

async function main() {
  const { provider, walletPath, admin } = loadProvider();
  const programId = loadProgramId();
  const program = loadProgram(provider, programId);
  const growMintValue =
    process.env.GROW_TOKEN_MINT || process.env.NEXT_PUBLIC_GROW_TOKEN_MINT;

  if (!growMintValue) {
    throw new Error("Set GROW_TOKEN_MINT to the deployed devnet $GROW mint.");
  }

  const growMint = new anchor.web3.PublicKey(growMintValue);
  const config = configPda(programId);
  const tokenProgram = await getMintTokenProgram(provider.connection, growMint);
  const treasuryVault = await ensureAssociatedTokenAccount({
    provider,
    mint: growMint,
    owner: config,
    tokenProgram,
  });

  const marketplaceFeeBps = parseIntegerEnv("MARKETPLACE_FEE_BPS", 250);
  const tradeFeeBps = parseIntegerEnv("TRADE_FEE_BPS", 100);
  const creatorFeeBps = parseIntegerEnv("CREATOR_FEE_BPS", 500);
  const burnFeeBps = parseIntegerEnv("BURN_FEE_BPS", 0);
  const existing = await fetchNullable(program, "config", config);

  console.log("GrowFi devnet config");
  console.log(`wallet: ${walletPath}`);
  printPda("program", programId);
  printPda("admin", admin);
  printPda("config PDA", config);
  printPda("grow mint", growMint);
  printPda("treasury vault", treasuryVault.address);
  console.log(`treasury vault ${treasuryVault.created ? "created" : "exists"}`);

  if (existing) {
    console.log(
      "config already initialized; no initialize_config transaction sent."
    );
    return;
  }

  try {
    const signature = await program.methods
      .initializeConfig(
        marketplaceFeeBps,
        tradeFeeBps,
        creatorFeeBps,
        burnFeeBps
      )
      .accounts({
        config,
        admin,
        growMint,
        treasuryVault: treasuryVault.address,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log(`initialize_config signature: ${signature}`);
    console.log(formatExplorer(signature));
  } catch (error) {
    if (await fetchNullable(program, "config", config)) {
      console.log(
        "config was initialized by another run; treating as success."
      );
      return;
    }
    throw new Error(decodeAnchorError(error));
  }
}

main().catch((error) => {
  console.error(decodeAnchorError(error));
  process.exit(1);
});
