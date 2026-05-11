import * as anchor from "@coral-xyz/anchor";

import {
  SEED_CATALOG,
  bn,
  bnToBigInt,
  configPda,
  decodeAnchorError,
  fetchNullable,
  formatExplorer,
  growBaseUnitsString,
  growBn,
  growFromBaseUnits,
  growToBaseUnits,
  loadProgram,
  loadProgramId,
  loadProvider,
  nameHash,
  printPda,
  rarityVariant,
  seedCatalogPda,
} from "./growfi-devnet-utils";

type SeedCatalogAccount = {
  price: unknown;
  growTimeSeconds: unknown;
  regrowTimeSeconds: unknown;
  minYield: number;
  maxYield: number;
  maxHarvests: number;
  mutationChanceBps: number;
  requiredGardenLevel: number;
  baseSellPrice: unknown;
  active: boolean;
  fruitId: { toString: () => string };
  rarity: unknown;
};

function sameMutableFields(
  account: SeedCatalogAccount,
  entry: (typeof SEED_CATALOG)[number]
) {
  return (
    bnToBigInt(account.price) === growToBaseUnits(entry.price) &&
    bnToBigInt(account.growTimeSeconds) === BigInt(entry.growTimeSeconds) &&
    bnToBigInt(account.regrowTimeSeconds) === BigInt(entry.regrowTimeSeconds) &&
    account.minYield === entry.minYield &&
    account.maxYield === entry.maxYield &&
    account.maxHarvests === entry.maxHarvests &&
    account.mutationChanceBps === entry.mutationChanceBps &&
    account.requiredGardenLevel === entry.requiredGardenLevel &&
    bnToBigInt(account.baseSellPrice) ===
      growToBaseUnits(entry.baseSellPrice) &&
    account.active === true
  );
}

function immutableWarnings(
  account: SeedCatalogAccount,
  entry: (typeof SEED_CATALOG)[number]
) {
  const warnings: string[] = [];
  if (bnToBigInt(account.fruitId) !== BigInt(entry.fruitId)) {
    warnings.push(
      `fruitId is ${account.fruitId.toString()}, expected ${entry.fruitId}`
    );
  }
  if (
    JSON.stringify(account.rarity) !==
    JSON.stringify(rarityVariant(entry.rarity))
  ) {
    warnings.push(`rarity differs; update_seed_catalog cannot change it`);
  }
  return warnings;
}

async function main() {
  const { provider, admin } = loadProvider();
  const programId = loadProgramId();
  const program = loadProgram(provider, programId);
  const config = configPda(programId);

  if (!(await fetchNullable(program, "config", config))) {
    throw new Error(
      "Config account is missing. Run anchor/scripts/initialize-config.ts first."
    );
  }

  console.log("Seeding GrowFi seed catalog");
  printPda("program", programId);
  printPda("admin", admin);
  printPda("config PDA", config);
  console.log("pricing: 9-decimal $GROW base units");

  for (const entry of SEED_CATALOG) {
    const seedCatalog = seedCatalogPda(entry.seedId, programId);
    const existing = (await fetchNullable(
      program,
      "seedCatalog",
      seedCatalog
    )) as SeedCatalogAccount | null;

    if (!existing) {
      const signature = await program.methods
        .createSeedCatalog(
          bn(entry.seedId),
          bn(entry.fruitId),
          nameHash(entry.name),
          rarityVariant(entry.rarity),
          growBn(entry.price),
          bn(entry.growTimeSeconds),
          bn(entry.regrowTimeSeconds),
          entry.minYield,
          entry.maxYield,
          entry.maxHarvests,
          entry.mutationChanceBps,
          entry.requiredGardenLevel,
          growBn(entry.baseSellPrice)
        )
        .accounts({
          config,
          seedCatalog,
          admin,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      console.log(`created ${entry.name} (${entry.seedId})`);
      printPda("  seed catalog", seedCatalog);
      console.log(
        `  price: ${entry.price} $GROW (${growBaseUnitsString(
          entry.price
        )} base units)`
      );
      console.log(`  signature: ${signature}`);
      console.log(`  ${formatExplorer(signature)}`);
      continue;
    }

    const warnings = immutableWarnings(existing, entry);
    for (const warning of warnings) {
      console.warn(`warning ${entry.name}: ${warning}`);
    }

    if (sameMutableFields(existing, entry)) {
      console.log(`unchanged ${entry.name} (${entry.seedId})`);
      printPda("  seed catalog", seedCatalog);
      console.log(
        `  price: ${growFromBaseUnits(
          existing.price
        )} $GROW (${existing.price.toString()} base units)`
      );
      continue;
    }

    const signature = await program.methods
      .updateSeedCatalog(
        growBn(entry.price),
        bn(entry.growTimeSeconds),
        bn(entry.regrowTimeSeconds),
        entry.minYield,
        entry.maxYield,
        entry.maxHarvests,
        entry.mutationChanceBps,
        entry.requiredGardenLevel,
        growBn(entry.baseSellPrice),
        true
      )
      .accounts({
        config,
        seedCatalog,
        admin,
      })
      .rpc();

    console.log(`updated ${entry.name} (${entry.seedId})`);
    printPda("  seed catalog", seedCatalog);
    console.log(
      `  price: ${entry.price} $GROW (${growBaseUnitsString(
        entry.price
      )} base units)`
    );
    console.log(`  signature: ${signature}`);
    console.log(`  ${formatExplorer(signature)}`);
  }
}

main().catch((error) => {
  console.error(decodeAnchorError(error));
  process.exit(1);
});
