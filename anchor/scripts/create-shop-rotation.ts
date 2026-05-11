import * as anchor from "@coral-xyz/anchor";

import {
  SEED_CATALOG,
  SHOP_STOCK_BY_RARITY,
  bn,
  configPda,
  decodeAnchorError,
  fetchNullable,
  formatExplorer,
  growBaseUnitsString,
  growBn,
  loadProgram,
  loadProgramId,
  loadProvider,
  parseIntegerEnv,
  printPda,
  seedCatalogPda,
  shopItemPda,
  shopRotationPda,
} from "./growfi-devnet-utils";

function selectedSeeds() {
  const raw = process.env.SHOP_SEED_IDS;
  if (!raw) {
    return SEED_CATALOG;
  }
  const selected = new Set(
    raw
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value))
  );
  return SEED_CATALOG.filter((entry) => selected.has(entry.seedId));
}

async function main() {
  const { provider, admin } = loadProvider();
  const programId = loadProgramId();
  const program = loadProgram(provider, programId);
  const config = configPda(programId);
  const durationSeconds = parseIntegerEnv(
    "SHOP_DURATION_SECONDS",
    parseIntegerEnv("DURATION_SECONDS", 300)
  );
  const now = Math.floor(Date.now() / 1000);
  const rotationId = process.env.SHOP_ROTATION_ID
    ? Number(process.env.SHOP_ROTATION_ID)
    : Math.floor(Date.now() / 1000);
  const startsAt = process.env.SHOP_STARTS_AT
    ? Number(process.env.SHOP_STARTS_AT)
    : now - 5;
  const endsAt = process.env.SHOP_ENDS_AT
    ? Number(process.env.SHOP_ENDS_AT)
    : now + durationSeconds;
  const shopRotation = shopRotationPda(rotationId, programId);

  if (!(await fetchNullable(program, "config", config))) {
    throw new Error(
      "Config account is missing. Run anchor/scripts/initialize-config.ts first."
    );
  }

  if (!Number.isFinite(rotationId) || rotationId <= 0) {
    throw new Error(
      "SHOP_ROTATION_ID must be a positive integer when provided."
    );
  }

  console.log("Creating GrowFi devnet shop rotation");
  printPda("program", programId);
  printPda("admin", admin);
  printPda("config PDA", config);
  console.log(`rotation ID: ${rotationId}`);
  printPda("shop rotation PDA", shopRotation);
  console.log(
    `starts at: ${startsAt} (${new Date(startsAt * 1000).toISOString()})`
  );
  console.log(`ends at: ${endsAt} (${new Date(endsAt * 1000).toISOString()})`);
  console.log("pricing: 9-decimal $GROW base units");

  if (await fetchNullable(program, "shopRotation", shopRotation)) {
    console.log("shop rotation already exists; reusing it.");
  } else {
    const signature = await program.methods
      .createShopRotation(bn(rotationId), bn(startsAt), bn(endsAt))
      .accounts({
        config,
        shopRotation,
        admin,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    console.log(`create_shop_rotation signature: ${signature}`);
    console.log(formatExplorer(signature));
  }

  for (const entry of selectedSeeds()) {
    const seedCatalog = seedCatalogPda(entry.seedId, programId);
    const shopItem = shopItemPda(rotationId, entry.seedId, programId);
    const stock = SHOP_STOCK_BY_RARITY[entry.rarity];

    if (!(await fetchNullable(program, "seedCatalog", seedCatalog))) {
      throw new Error(
        `SeedCatalog for ${entry.name} (${entry.seedId}) is missing. Run seed-catalog.ts first.`
      );
    }

    if (await fetchNullable(program, "shopItem", shopItem)) {
      console.log(`shop item exists ${entry.name}`);
      printPda("  seed catalog PDA", seedCatalog);
      printPda("  shop item PDA", shopItem);
      continue;
    }

    const signature = await program.methods
      .createShopItem(
        bn(rotationId),
        bn(entry.seedId),
        growBn(entry.price),
        bn(stock.stockTotal),
        bn(stock.maxBuyPerUser)
      )
      .accounts({
        config,
        shopRotation,
        seedCatalog,
        shopItem,
        admin,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log(`created shop item ${entry.name}`);
    printPda("  seed catalog PDA", seedCatalog);
    printPda("  shop item PDA", shopItem);
    console.log(
      `  price: ${entry.price} $GROW (${growBaseUnitsString(
        entry.price
      )} base units)`
    );
    console.log(
      `  stock: ${stock.stockTotal}, max buy/user: ${stock.maxBuyPerUser}`
    );
    console.log(`  signature: ${signature}`);
    console.log(`  ${formatExplorer(signature)}`);
  }
}

main().catch((error) => {
  console.error(decodeAnchorError(error));
  process.exit(1);
});
