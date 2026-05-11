import * as anchor from "@coral-xyz/anchor";

import {
  SEED_CATALOG,
  associatedTokenAddress,
  bn,
  bnToNumber,
  configPda,
  decodeAnchorError,
  decorationInventoryPda,
  ensureAssociatedTokenAccount,
  farmPda,
  fetchNullable,
  findActiveShopRotation,
  formatExplorer,
  formatUnix,
  fruitInventoryPda,
  getMintTokenProgram,
  isDecodedError,
  loadProgram,
  loadProgramId,
  loadProvider,
  playerPda,
  plotPda,
  printPda,
  seedCatalogPda,
  seedInventoryPda,
  shopItemPda,
  shopPurchasePda,
  shopRotationPda,
} from "./growfi-devnet-utils";

function zeroHash() {
  return Array(32).fill(0);
}

function variantName(value: unknown) {
  if (!value || typeof value !== "object") {
    return String(value);
  }
  return Object.keys(value as Record<string, unknown>)[0] || String(value);
}

function seedName(seedId: number) {
  return (
    SEED_CATALOG.find((entry) => entry.seedId === seedId)?.name ||
    `seed ${seedId}`
  );
}

type ConfigAccount = {
  growMint: anchor.web3.PublicKey;
  treasuryVault: anchor.web3.PublicKey;
};

type PlotAccount = {
  state: unknown;
  seedId: unknown;
  plantedAt: unknown;
  waterLevel: unknown;
  health: unknown;
  growCompleteAt: unknown;
  nextHarvestAt: unknown;
  harvestCount: unknown;
  maxHarvests: unknown;
};

type PlayerAccount = {
  gardenLevel: number;
  stamina: number;
  maxStamina: number;
  waterCharges: number;
  maxWaterCharges: number;
  farm: anchor.web3.PublicKey;
};

type FarmAccount = {
  level: number;
  width: number;
  height: number;
  plotCount: number;
};

type SeedInventoryAccount = {
  balances: Array<{ itemId: unknown; amount: unknown }>;
};

type FruitInventoryAccount = {
  balances: Array<{ fruitId: unknown; mutation: unknown; amount: unknown }>;
};

async function main() {
  const { provider, admin } = loadProvider();
  const programId = loadProgramId();
  const program = loadProgram(provider, programId);
  const config = configPda(programId);
  const configAccount = (await fetchNullable(
    program,
    "config",
    config
  )) as ConfigAccount | null;

  if (!configAccount) {
    throw new Error(
      "Config account is missing. Run anchor/scripts/initialize-config.ts first."
    );
  }

  const growMint = new anchor.web3.PublicKey(
    process.env.GROW_TOKEN_MINT ||
      process.env.NEXT_PUBLIC_GROW_TOKEN_MINT ||
      configAccount.growMint.toBase58()
  );
  const tokenProgram = await getMintTokenProgram(provider.connection, growMint);
  const treasuryVault = configAccount.treasuryVault as anchor.web3.PublicKey;
  const player = playerPda(admin, programId);
  const farm = farmPda(admin, programId);
  const seedInventory = seedInventoryPda(admin, programId);
  const fruitInventory = fruitInventoryPda(admin, programId);
  const decorationInventory = decorationInventoryPda(admin, programId);
  const signatures: Array<{ label: string; signature: string }> = [];

  console.log("GrowFi deployed devnet player flow");
  printPda("program", programId);
  printPda("admin", admin);
  printPda("config PDA", config);
  printPda("grow mint", growMint);
  printPda("treasury vault", treasuryVault);
  printPda("player PDA", player);
  printPda("farm PDA", farm);
  printPda("seed inventory PDA", seedInventory);
  printPda("fruit inventory PDA", fruitInventory);
  printPda("decoration inventory PDA", decorationInventory);

  const buyerGrowAta = await ensureAssociatedTokenAccount({
    provider,
    mint: growMint,
    owner: admin,
    tokenProgram,
  });
  printPda("buyer grow ATA", buyerGrowAta.address);
  if (buyerGrowAta.signature) {
    signatures.push({
      label: "create buyer grow ATA",
      signature: buyerGrowAta.signature,
    });
  }

  try {
    const balance = await provider.connection.getTokenAccountBalance(
      buyerGrowAta.address
    );
    console.log(
      `buyer grow ATA balance: ${
        balance.value.uiAmountString ?? balance.value.amount
      }`
    );
  } catch {
    console.log("buyer grow ATA balance: unavailable");
  }

  if (!(await fetchNullable(program, "player", player))) {
    const signature = await program.methods
      .createPlayer(zeroHash(), zeroHash())
      .accounts({
        config,
        player,
        seedInventory,
        fruitInventory,
        decorationInventory,
        authority: admin,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    signatures.push({ label: "create_player", signature });
    console.log(`created player: ${signature}`);
  } else {
    console.log("player already exists; skipping create_player.");
  }

  if (!(await fetchNullable(program, "farm", farm))) {
    const signature = await program.methods
      .createFarm()
      .accounts({
        config,
        player,
        farm,
        owner: admin,
        authority: admin,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    signatures.push({ label: "create_farm", signature });
    console.log(`created farm: ${signature}`);
  } else {
    console.log("farm already exists; skipping create_farm.");
  }

  for (let y = 0; y < 4; y += 1) {
    for (let x = 0; x < 4; x += 1) {
      const plot = plotPda(farm, x, y, programId);
      if (await fetchNullable(program, "plot", plot)) {
        continue;
      }
      const signature = await program.methods
        .createInitialPlots(x, y)
        .accounts({
          config,
          farm,
          plot,
          owner: admin,
          authority: admin,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      signatures.push({ label: `create_initial_plots ${x},${y}`, signature });
      console.log(`created plot ${x},${y}: ${signature}`);
    }
  }

  const seedId = Number(
    process.env.TEST_SEED_ID || process.env.FAST_TEST_SEED_ID || 1
  );
  const rotationId = process.env.TEST_ROTATION_ID
    ? Number(process.env.TEST_ROTATION_ID)
    : process.env.SHOP_ROTATION_ID
    ? Number(process.env.SHOP_ROTATION_ID)
    : (await findActiveShopRotation(program))?.rotationId;

  if (!rotationId) {
    throw new Error(
      "No active shop rotation found. Run create-shop-rotation.ts first, or set TEST_ROTATION_ID."
    );
  }

  const shopRotation = shopRotationPda(rotationId, programId);
  const shopItem = shopItemPda(rotationId, seedId, programId);
  const seedCatalog = seedCatalogPda(seedId, programId);
  const shopPurchase = shopPurchasePda(admin, rotationId, seedId, programId);

  console.log(`test seed: ${seedName(seedId)} (${seedId})`);
  console.log(`rotation ID: ${rotationId}`);
  printPda("shop rotation PDA", shopRotation);
  printPda("shop item PDA", shopItem);
  printPda("seed catalog PDA", seedCatalog);
  printPda("shop purchase PDA", shopPurchase);

  if (!(await fetchNullable(program, "shopItem", shopItem))) {
    throw new Error(
      `Shop item for seed ${seedId} is missing in rotation ${rotationId}.`
    );
  }

  try {
    const signature = await program.methods
      .buySeed(bn(rotationId), bn(seedId), bn(1))
      .accounts({
        config,
        player,
        seedInventory,
        shopRotation,
        shopItem,
        seedCatalog,
        shopPurchase,
        buyer: admin,
        growMint,
        buyerGrowAta: buyerGrowAta.address,
        treasuryVault,
        tokenProgram,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    signatures.push({ label: "buy_seed", signature });
    console.log(`bought ${seedName(seedId)}: ${signature}`);
  } catch (error) {
    if (isDecodedError(error, "MaxBuyReached")) {
      console.log(
        "buy_seed skipped: per-user buy limit already reached for this rotation."
      );
    } else {
      throw new Error(`buy_seed failed: ${decodeAnchorError(error)}`);
    }
  }

  const x = Number(process.env.TEST_PLOT_X || 0);
  const y = Number(process.env.TEST_PLOT_Y || 0);
  const plot = plotPda(farm, x, y, programId);
  printPda(`plot ${x},${y} PDA`, plot);

  let plotAccount = (await fetchNullable(
    program,
    "plot",
    plot
  )) as PlotAccount | null;
  if (!plotAccount) {
    throw new Error(`Plot ${x},${y} is missing.`);
  }

  if (variantName(plotAccount.state).toLowerCase() === "empty") {
    try {
      const signature = await program.methods
        .plantSeed()
        .accounts({
          config,
          player,
          seedInventory,
          seedCatalog,
          farm,
          plot,
          authority: admin,
        })
        .rpc();
      signatures.push({ label: "plant_seed", signature });
      console.log(`planted ${seedName(seedId)} on ${x},${y}: ${signature}`);
      plotAccount = (await fetchNullable(
        program,
        "plot",
        plot
      )) as PlotAccount | null;
    } catch (error) {
      throw new Error(`plant_seed failed: ${decodeAnchorError(error)}`);
    }
  } else {
    console.log(
      `plot ${x},${y} already ${variantName(
        plotAccount.state
      )}; skipping plant_seed.`
    );
  }

  plotAccount = (await fetchNullable(
    program,
    "plot",
    plot
  )) as PlotAccount | null;
  const activeState = variantName(plotAccount?.state).toLowerCase();
  if (
    plotAccount &&
    ["growing", "ready", "regrowing"].includes(activeState) &&
    bnToNumber(plotAccount.waterLevel) < 5
  ) {
    try {
      const signature = await program.methods
        .waterPlant()
        .accounts({
          config,
          player,
          farm,
          plot,
          authority: admin,
        })
        .rpc();
      signatures.push({ label: "water_plant", signature });
      console.log(`watered plant on ${x},${y}: ${signature}`);
    } catch (error) {
      throw new Error(`water_plant failed: ${decodeAnchorError(error)}`);
    }
  } else {
    console.log(`water_plant skipped for state ${activeState}.`);
  }

  const finalPlot = (await fetchNullable(
    program,
    "plot",
    plot
  )) as PlotAccount | null;
  const [finalPlayer, finalFarm, finalSeedInventory, finalFruitInventory] =
    (await Promise.all([
      fetchNullable(program, "player", player),
      fetchNullable(program, "farm", farm),
      fetchNullable(program, "seedInventory", seedInventory),
      fetchNullable(program, "fruitInventory", fruitInventory),
    ])) as [
      PlayerAccount | null,
      FarmAccount | null,
      SeedInventoryAccount | null,
      FruitInventoryAccount | null
    ];

  console.log("final on-chain account state");
  if (finalPlayer) {
    console.log(
      `player: level=${finalPlayer.gardenLevel}, stamina=${
        finalPlayer.stamina
      }/${finalPlayer.maxStamina}, water=${finalPlayer.waterCharges}/${
        finalPlayer.maxWaterCharges
      }, farm=${finalPlayer.farm.toBase58()}`
    );
  }
  if (finalFarm) {
    console.log(
      `farm: level=${finalFarm.level}, size=${finalFarm.width}x${finalFarm.height}, plots=${finalFarm.plotCount}`
    );
  }
  if (finalSeedInventory) {
    console.log(
      `seed inventory: ${finalSeedInventory.balances
        .map(
          (balance) =>
            `${bnToNumber(balance.itemId)}=${bnToNumber(balance.amount)}`
        )
        .join(", ")}`
    );
  }
  if (finalFruitInventory) {
    console.log(
      `fruit inventory: ${
        finalFruitInventory.balances.length
          ? finalFruitInventory.balances
              .map(
                (balance) =>
                  `${bnToNumber(balance.fruitId)}/${variantName(
                    balance.mutation
                  )}=${bnToNumber(balance.amount)}`
              )
              .join(", ")
          : "empty"
      }`
    );
  }
  console.log(`plot state: ${variantName(finalPlot?.state)}`);
  console.log(`plot seedId: ${bnToNumber(finalPlot?.seedId || 0)}`);
  console.log(`plantedAt: ${formatUnix(finalPlot?.plantedAt)}`);
  console.log(`growCompleteAt: ${formatUnix(finalPlot?.growCompleteAt)}`);
  console.log(`nextHarvestAt: ${formatUnix(finalPlot?.nextHarvestAt)}`);
  console.log(
    `water=${bnToNumber(finalPlot?.waterLevel || 0)}, health=${bnToNumber(
      finalPlot?.health || 0
    )}, harvests=${bnToNumber(finalPlot?.harvestCount || 0)}/${bnToNumber(
      finalPlot?.maxHarvests || 0
    )}`
  );

  console.log("transaction signatures");
  for (const item of signatures) {
    console.log(`${item.label}: ${item.signature}`);
    console.log(`  ${formatExplorer(item.signature)}`);
  }

  const expectedAta = associatedTokenAddress(growMint, admin, tokenProgram);
  if (!expectedAta.equals(buyerGrowAta.address)) {
    throw new Error("Derived buyer ATA mismatch.");
  }
}

main().catch((error) => {
  console.error(decodeAnchorError(error));
  process.exit(1);
});
