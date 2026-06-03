pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use errors::*;
pub use events::*;
use instructions::*;
pub use state::*;

declare_id!("3kuJMbz1mRpTiHzV3ajGN9d2Lk1gx78spe2Vi2TBTSEH");

#[program]
pub mod growfi_core {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        marketplace_fee_bps: u16,
        trade_fee_bps: u16,
        creator_fee_bps: u16,
        burn_fee_bps: u16,
    ) -> Result<()> {
        instructions::initialize_config(
            ctx,
            marketplace_fee_bps,
            trade_fee_bps,
            creator_fee_bps,
            burn_fee_bps,
        )
    }

    pub fn update_config(
        ctx: Context<UpdateConfig>,
        admin: Pubkey,
        treasury_vault: Pubkey,
        marketplace_fee_bps: u16,
        trade_fee_bps: u16,
        creator_fee_bps: u16,
        burn_fee_bps: u16,
    ) -> Result<()> {
        instructions::update_config(
            ctx,
            admin,
            treasury_vault,
            marketplace_fee_bps,
            trade_fee_bps,
            creator_fee_bps,
            burn_fee_bps,
        )
    }

    pub fn set_pause(ctx: Context<UpdateConfig>, paused: bool) -> Result<()> {
        instructions::set_pause(ctx, paused)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn create_seed_catalog(
        ctx: Context<CreateSeedCatalog>,
        seed_id: u64,
        fruit_id: u64,
        name_hash: [u8; 32],
        rarity: RarityKind,
        price: u64,
        grow_time_seconds: i64,
        regrow_time_seconds: i64,
        min_yield: u16,
        max_yield: u16,
        max_harvests: u16,
        mutation_chance_bps: u16,
        required_garden_level: u8,
        base_sell_price: u64,
    ) -> Result<()> {
        instructions::create_seed_catalog(
            ctx,
            seed_id,
            fruit_id,
            name_hash,
            rarity,
            price,
            grow_time_seconds,
            regrow_time_seconds,
            min_yield,
            max_yield,
            max_harvests,
            mutation_chance_bps,
            required_garden_level,
            base_sell_price,
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub fn update_seed_catalog(
        ctx: Context<UpdateSeedCatalog>,
        price: u64,
        grow_time_seconds: i64,
        regrow_time_seconds: i64,
        min_yield: u16,
        max_yield: u16,
        max_harvests: u16,
        mutation_chance_bps: u16,
        required_garden_level: u8,
        base_sell_price: u64,
        active: bool,
    ) -> Result<()> {
        instructions::update_seed_catalog(
            ctx,
            price,
            grow_time_seconds,
            regrow_time_seconds,
            min_yield,
            max_yield,
            max_harvests,
            mutation_chance_bps,
            required_garden_level,
            base_sell_price,
            active,
        )
    }

    pub fn create_shop_rotation(
        ctx: Context<CreateShopRotation>,
        rotation_id: u64,
        starts_at: i64,
        ends_at: i64,
    ) -> Result<()> {
        instructions::create_shop_rotation(ctx, rotation_id, starts_at, ends_at)
    }

    pub fn create_shop_item(
        ctx: Context<CreateShopItem>,
        rotation_id: u64,
        seed_id: u64,
        price: u64,
        stock_total: u64,
        max_buy_per_user: u64,
    ) -> Result<()> {
        instructions::create_shop_item(
            ctx,
            rotation_id,
            seed_id,
            price,
            stock_total,
            max_buy_per_user,
        )
    }

    pub fn create_player(
        ctx: Context<CreatePlayer>,
        discord_hash: [u8; 32],
        username_hash: [u8; 32],
    ) -> Result<()> {
        instructions::create_player(ctx, discord_hash, username_hash)
    }

    pub fn create_farm(ctx: Context<CreateFarm>) -> Result<()> {
        instructions::create_farm(ctx)
    }

    pub fn create_initial_plots(
        ctx: Context<CreateInitialPlots>,
        x: u16,
        y: u16,
    ) -> Result<()> {
        instructions::create_initial_plots(ctx, x, y)
    }

    pub fn upgrade_farm(ctx: Context<UpgradeFarm>) -> Result<()> {
        instructions::upgrade_farm(ctx)
    }

    pub fn refill_water(ctx: Context<RefillWater>) -> Result<()> {
        instructions::refill_water(ctx)
    }

    pub fn buy_seed(
        ctx: Context<BuySeed>,
        rotation_id: u64,
        seed_id: u64,
        quantity: u64,
    ) -> Result<()> {
        instructions::buy_seed(ctx, rotation_id, seed_id, quantity)
    }

    pub fn plant_seed(ctx: Context<PlantSeed>) -> Result<()> {
        instructions::plant_seed(ctx)
    }

    pub fn water_plant(ctx: Context<WaterPlant>) -> Result<()> {
        instructions::water_plant(ctx)
    }

    pub fn harvest_plant(ctx: Context<HarvestPlant>) -> Result<()> {
        instructions::harvest_plant(ctx)
    }

    pub fn sell_fruit_to_system(
        ctx: Context<SellFruitToSystem>,
        mutation: MutationKind,
        quantity: u64,
    ) -> Result<()> {
        instructions::sell_fruit_to_system(ctx, mutation, quantity)
    }

    pub fn create_listing(
        ctx: Context<CreateListing>,
        listing_id: u64,
        fruit_id: u64,
        mutation: MutationKind,
        quantity: u64,
        price: u64,
        expires_at: i64,
    ) -> Result<()> {
        instructions::create_listing(ctx, listing_id, fruit_id, mutation, quantity, price, expires_at)
    }

    pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
        instructions::cancel_listing(ctx)
    }

    pub fn buy_listing(ctx: Context<BuyListing>) -> Result<()> {
        instructions::buy_listing(ctx)
    }

    pub fn create_trade(
        ctx: Context<CreateTrade>,
        trade_id: u64,
        expires_at: i64,
    ) -> Result<()> {
        instructions::create_trade(ctx, trade_id, expires_at)
    }

    pub fn update_trade_offer(
        ctx: Context<UpdateTradeOffer>,
        grow_amount: u64,
        items: Vec<TradeItem>,
    ) -> Result<()> {
        instructions::update_trade_offer(ctx, grow_amount, items)
    }

    pub fn confirm_trade(ctx: Context<ConfirmTrade>) -> Result<()> {
        instructions::confirm_trade(ctx)
    }

    pub fn cancel_trade(ctx: Context<CancelTrade>) -> Result<()> {
        instructions::cancel_trade(ctx)
    }

    pub fn complete_trade(ctx: Context<CompleteTrade>) -> Result<()> {
        instructions::complete_trade(ctx)
    }

    pub fn enable_creator(ctx: Context<EnableCreator>, profile_hash: [u8; 32]) -> Result<()> {
        instructions::enable_creator(ctx, profile_hash)
    }

    pub fn update_creator_profile_hash(
        ctx: Context<UpdateCreatorProfileHash>,
        profile_hash: [u8; 32],
    ) -> Result<()> {
        instructions::update_creator_profile_hash(ctx, profile_hash)
    }

    pub fn like_farm(ctx: Context<LikeFarm>) -> Result<()> {
        instructions::like_farm(ctx)
    }

    pub fn tip_creator(ctx: Context<TipCreator>, amount: u64) -> Result<()> {
        instructions::tip_creator(ctx, amount)
    }

    pub fn buy_decoration(
        ctx: Context<BuyDecoration>,
        decoration_id: u64,
        price: u64,
    ) -> Result<()> {
        instructions::buy_decoration(ctx, decoration_id, price)
    }

    pub fn place_decoration(
        ctx: Context<PlaceDecoration>,
        placement_id: u64,
        decoration_id: u64,
        x: u16,
        y: u16,
        rotation: u16,
    ) -> Result<()> {
        instructions::place_decoration(ctx, placement_id, decoration_id, x, y, rotation)
    }

    pub fn remove_decoration(ctx: Context<RemoveDecoration>) -> Result<()> {
        instructions::remove_decoration(ctx)
    }

    pub fn create_challenge(
        ctx: Context<CreateChallenge>,
        challenge_id: u64,
        objective_type: u8,
        target: u64,
        reward_grow: u64,
        starts_at: i64,
        ends_at: i64,
    ) -> Result<()> {
        instructions::create_challenge(
            ctx,
            challenge_id,
            objective_type,
            target,
            reward_grow,
            starts_at,
            ends_at,
        )
    }

    pub fn join_challenge(ctx: Context<JoinChallenge>) -> Result<()> {
        instructions::join_challenge(ctx)
    }

    pub fn update_progress(ctx: Context<UpdateProgress>, amount: u64) -> Result<()> {
        instructions::update_progress(ctx, amount)
    }

    pub fn claim_challenge_reward(ctx: Context<ClaimChallengeReward>) -> Result<()> {
        instructions::claim_challenge_reward(ctx)
    }
}
