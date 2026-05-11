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

  [
    "initialize config",
    "create player/farm",
    "create seed catalog",
    "create shop rotation/item",
    "buy seed",
    "plant seed",
    "water plant",
    "harvest plant",
    "max harvest behavior",
    "garden level requirement",
    "upgrade farm",
    "create marketplace listing",
    "cancel listing",
    "buy listing",
    "create trade",
    "complete trade",
    "creator tip",
    "decoration purchase/place",
    "invalid/abuse cases",
  ].forEach((name) => {
    it.skip(`integration: ${name}`, () => {
      // Requires a full SPL $GROW mint/vault fixture. The compile-time IDL
      // coverage above keeps the account/instruction surface locked until the
      // transaction fixture is added.
    });
  });
});
