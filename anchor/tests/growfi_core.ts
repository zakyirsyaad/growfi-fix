import { expect } from "chai";
import * as fs from "fs";
const idl = JSON.parse(fs.readFileSync(new URL("../../lib/idl/growfi_core.json", import.meta.url), "utf8"));

const deployedProgramId = "ESiJ1Fk5b9X8GitSjNW44LzRNBWByrHa7kkEWsTPmDYz";
const repoRoot = new URL("../../", import.meta.url);

function readRepoFile(path: string) {
  return fs.readFileSync(new URL(path, repoRoot), "utf8");
}


describe("growfi_core IDL smoke tests", () => {
  it("keeps program ids in sync with the deployed devnet program", () => {
    expect(idl.address).to.equal(deployedProgramId);
    expect(readRepoFile("lib/solana/growfiCore.ts")).to.contain(`"${deployedProgramId}"`);
    expect(readRepoFile("anchor/Anchor.toml")).to.contain(`growfi_core = "${deployedProgramId}"`);
    expect(readRepoFile("anchor/programs/growfi_core/src/lib.rs")).to.contain(
      `declare_id!("${deployedProgramId}")`
    );
  });

  const instructionNames = idl.instructions.map(
    (instruction) => instruction.name
  );
  const accountNames = idl.accounts.map((account) => account.name);
  const errorNames = idl.errors.map((error) => error.name);

  it("exposes the required on-chain game instructions", () => {
    expect(instructionNames).to.include.members([
      "initialize_config",
      "update_config",
      "set_pause",
      "create_seed_catalog",
      "update_seed_catalog",
      "create_shop_rotation",
      "create_shop_item",
      "create_player",
      "create_farm",
      "create_initial_plots",
      "upgrade_farm",
      "refill_water",
      "buy_seed",
      "plant_seed",
      "water_plant",
      "harvest_plant",
      "sell_fruit_to_system",
      "create_listing",
      "cancel_listing",
      "buy_listing",
      "create_trade",
      "update_trade_offer",
      "confirm_trade",
      "cancel_trade",
      "complete_trade",
      "enable_creator",
      "update_creator_profile_hash",
      "like_farm",
      "tip_creator",
      "buy_decoration",
      "place_decoration",
      "remove_decoration",
      "create_challenge",
      "join_challenge",
      "update_progress",
      "claim_challenge_reward",
    ]);
  });

  it("publishes PDA account types for on-chain source-of-truth state", () => {
    expect(accountNames).to.include.members([
      "Config",
      "Player",
      "Farm",
      "Plot",
      "SeedInventory",
      "FruitInventory",
      "SeedCatalog",
      "ShopRotation",
      "ShopItem",
      "ShopPurchase",
      "MarketplaceListing",
      "Trade",
      "CreatorProfile",
      "DecorationInventory",
      "DecorationPlacement",
      "Challenge",
      "ChallengeProgress",
    ]);
  });

  it("publishes gameplay/economy abuse-prevention errors", () => {
    expect(errorNames).to.include.members([
      "GamePaused",
      "Unauthorized",
      "InvalidMint",
      "InsufficientBalance",
      "InsufficientSeed",
      "InsufficientFruit",
      "FruitLocked",
      "PlotNotEmpty",
      "PlotEmpty",
      "PlantNotReady",
      "GardenLevelTooLow",
      "InsufficientStamina",
      "InsufficientWater",
      "ShopExpired",
      "ShopOutOfStock",
      "MaxBuyReached",
      "ListingInactive",
      "ListingExpired",
      "TradeExpired",
      "TradeNotConfirmed",
      "InvalidTradeState",
      "AlreadyClaimed",
      "InvalidAmount",
      "MathOverflow",
    ]);
  });

  describe("integration: basic setup and economy", () => {
    it.skip("initialize config", () => {
      // Requires Solana SBF toolchain and a local validator fixture.
    });

    it.skip("create player", () => {
      // Requires Solana SBF toolchain and a local validator fixture.
    });

    it.skip("create farm", () => {
      // Requires Solana SBF toolchain and a local validator fixture.
    });

    it.skip("create initial plots", () => {
      // Requires Solana SBF toolchain and a local validator fixture.
    });

    it.skip("reject duplicate player/farm", () => {
      // Requires Solana SBF toolchain and a local validator fixture.
    });

    it.skip("reject unauthorized config update", () => {
      // Requires Solana SBF toolchain and a local validator fixture.
    });
  });

  describe("integration: economy abuse tests", () => {
    it.skip("buy seed fails when shop expired", () => {
      // Requires Solana SBF toolchain and a local validator fixture.
    });

    it.skip("buy seed fails when quantity exceeds stock", () => {
      // Requires Solana SBF toolchain and a local validator fixture.
    });

    it.skip("plant seed fails when plot is not empty", () => {
      // Requires Solana SBF toolchain and a local validator fixture.
    });

    it.skip("harvest fails before ready time", () => {
      // Requires Solana SBF toolchain and a local validator fixture.
    });

    it.skip("marketplace buy fails when listing expired", () => {
      // Requires Solana SBF toolchain and a local validator fixture.
    });

    it.skip("trade complete fails without both confirmations", () => {
      // Requires Solana SBF toolchain and a local validator fixture.
    });
  });
});
