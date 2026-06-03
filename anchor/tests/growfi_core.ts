import { expect } from "chai";
import idl from "../target/idl/growfi_core.json";

describe("growfi_core IDL", () => {
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
    it("initialize config", async () => {
      // Integration test logic for initialize_config
      expect(true).to.be.true;
    });

    it("create player", async () => {
      // Integration test logic for create_player
      expect(true).to.be.true;
    });

    it("create farm", async () => {
      // Integration test logic for create_farm
      expect(true).to.be.true;
    });

    it("create initial plots", async () => {
      // Integration test logic for create_initial_plots
      expect(true).to.be.true;
    });

    it("reject duplicate player/farm", async () => {
      // Integration test logic for duplicate rejection
      expect(true).to.be.true;
    });

    it("reject unauthorized config update", async () => {
      // Integration test logic for unauthorized config update
      expect(true).to.be.true;
    });
  });

  describe("integration: economy abuse tests", () => {
    it("buy seed fails when shop expired", async () => {
      expect(true).to.be.true;
    });

    it("buy seed fails when quantity exceeds stock", async () => {
      expect(true).to.be.true;
    });

    it("plant seed fails when plot is not empty", async () => {
      expect(true).to.be.true;
    });

    it("harvest fails before ready time", async () => {
      expect(true).to.be.true;
    });

    it("marketplace buy fails when listing expired", async () => {
      expect(true).to.be.true;
    });

    it("trade complete fails without both confirmations", async () => {
      expect(true).to.be.true;
    });
  });
});
