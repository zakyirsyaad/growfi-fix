use anchor_lang::prelude::*;

use crate::errors::GrowfiError;

pub const MAX_SEED_BALANCES: usize = 64;
pub const MAX_FRUIT_BALANCES: usize = 128;
pub const MAX_DECORATION_BALANCES: usize = 64;
pub const MAX_TRADE_ITEMS: usize = 16;
pub const STAMINA_REGEN_SECONDS: i64 = 180;
pub const WATER_MAX_LEVEL: u8 = 5;
pub const WATER_HEALTH_GAIN: u8 = 4;
pub const HARVEST_HEALTH_GAIN: u8 = 2;
pub const PLANT_STAMINA_COST: u16 = 1;
pub const WATER_STAMINA_COST: u16 = 1;
pub const HARVEST_STAMINA_COST: u16 = 2;
pub const DAILY_SELL_CAP: u64 = 10_000_000_000_000; // 10,000 $GROW with 9 decimals.

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub grow_mint: Pubkey,
    pub treasury_vault: Pubkey,
    pub marketplace_fee_bps: u16,
    pub trade_fee_bps: u16,
    pub creator_fee_bps: u16,
    pub burn_fee_bps: u16,
    pub paused: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Player {
    pub authority: Pubkey,
    pub discord_hash: [u8; 32],
    pub username_hash: [u8; 32],
    pub farm: Pubkey,
    pub garden_level: u8,
    pub stamina: u16,
    pub max_stamina: u16,
    pub water_charges: u16,
    pub max_water_charges: u16,
    pub last_stamina_update: i64,
    pub total_harvests: u64,
    pub total_trades: u64,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Farm {
    pub owner: Pubkey,
    pub level: u8,
    pub width: u8,
    pub height: u8,
    pub plot_count: u16,
    pub total_visits: u64,
    pub total_likes: u64,
    pub is_public: bool,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Plot {
    pub farm: Pubkey,
    pub owner: Pubkey,
    pub x: u16,
    pub y: u16,
    pub state: PlotState,
    pub seed_id: u64,
    pub planted_at: i64,
    pub grow_complete_at: i64,
    pub next_harvest_at: i64,
    pub harvest_count: u16,
    pub max_harvests: u16,
    pub water_level: u8,
    pub health: u8,
    pub permanent_mutation: MutationKind,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct SeedInventory {
    pub owner: Pubkey,
    #[max_len(MAX_SEED_BALANCES)]
    pub balances: Vec<ItemBalance>,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct FruitInventory {
    pub owner: Pubkey,
    #[max_len(MAX_FRUIT_BALANCES)]
    pub balances: Vec<FruitBalance>,
    pub daily_sold_at: i64,
    pub daily_sold_amount: u64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub struct ItemBalance {
    pub item_id: u64,
    pub amount: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub struct FruitBalance {
    pub fruit_id: u64,
    pub mutation: MutationKind,
    pub amount: u64,
    pub locked_amount: u64,
}

#[account]
#[derive(InitSpace)]
pub struct SeedCatalog {
    pub seed_id: u64,
    pub fruit_id: u64,
    pub name_hash: [u8; 32],
    pub rarity: RarityKind,
    pub price: u64,
    pub grow_time_seconds: i64,
    pub regrow_time_seconds: i64,
    pub min_yield: u16,
    pub max_yield: u16,
    pub max_harvests: u16,
    pub mutation_chance_bps: u16,
    pub required_garden_level: u8,
    pub base_sell_price: u64,
    pub active: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ShopRotation {
    pub rotation_id: u64,
    pub starts_at: i64,
    pub ends_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ShopItem {
    pub rotation_id: u64,
    pub seed_id: u64,
    pub price: u64,
    pub stock_total: u64,
    pub stock_remaining: u64,
    pub max_buy_per_user: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ShopPurchase {
    pub buyer: Pubkey,
    pub rotation_id: u64,
    pub seed_id: u64,
    pub amount_bought: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct MarketplaceListing {
    pub listing_id: u64,
    pub seller: Pubkey,
    pub fruit_id: u64,
    pub mutation: MutationKind,
    pub quantity: u64,
    pub price: u64,
    pub status: ListingStatus,
    pub created_at: i64,
    pub expires_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Trade {
    pub trade_id: u64,
    pub initiator: Pubkey,
    pub recipient: Pubkey,
    pub status: TradeStatus,
    pub initiator_confirmed: bool,
    pub recipient_confirmed: bool,
    pub initiator_grow_amount: u64,
    pub recipient_grow_amount: u64,
    #[max_len(MAX_TRADE_ITEMS)]
    pub initiator_items: Vec<TradeItem>,
    #[max_len(MAX_TRADE_ITEMS)]
    pub recipient_items: Vec<TradeItem>,
    pub expires_at: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub struct TradeItem {
    pub fruit_id: u64,
    pub mutation: MutationKind,
    pub quantity: u64,
}

#[account]
#[derive(InitSpace)]
pub struct CreatorProfile {
    pub owner: Pubkey,
    pub active: bool,
    pub profile_hash: [u8; 32],
    pub total_visits: u64,
    pub total_likes: u64,
    pub total_earnings: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct DecorationInventory {
    pub owner: Pubkey,
    #[max_len(MAX_DECORATION_BALANCES)]
    pub balances: Vec<ItemBalance>,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct DecorationPlacement {
    pub farm: Pubkey,
    pub owner: Pubkey,
    pub placement_id: u64,
    pub decoration_id: u64,
    pub x: u16,
    pub y: u16,
    pub rotation: u16,
    pub active: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Challenge {
    pub challenge_id: u64,
    pub creator: Pubkey,
    pub objective_type: u8,
    pub target: u64,
    pub reward_grow: u64,
    pub starts_at: i64,
    pub ends_at: i64,
    pub active: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ChallengeProgress {
    pub challenge: Pubkey,
    pub player: Pubkey,
    pub progress: u64,
    pub joined_at: i64,
    pub claimed: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum PlotState {
    Empty,
    Growing,
    Ready,
    Regrowing,
    Locked,
    Withered,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum MutationKind {
    Normal,
    Big,
    Sweet,
    Golden,
    Crystal,
    Rainbow,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum RarityKind {
    Common,
    Uncommon,
    Rare,
    Epic,
    Legendary,
    Mythic,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum ListingStatus {
    Active,
    Sold,
    Cancelled,
    Expired,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum TradeStatus {
    Pending,
    Active,
    Locked,
    Completed,
    Cancelled,
    Expired,
}

pub fn assert_not_paused(config: &Config) -> Result<()> {
    require!(!config.paused, GrowfiError::GamePaused);
    Ok(())
}

pub fn assert_admin(config: &Config, admin: Pubkey) -> Result<()> {
    require_keys_eq!(config.admin, admin, GrowfiError::Unauthorized);
    Ok(())
}

pub fn add_seed_balance(inventory: &mut SeedInventory, seed_id: u64, amount: u64) -> Result<()> {
    require!(amount > 0, GrowfiError::InvalidAmount);
    if let Some(balance) = inventory
        .balances
        .iter_mut()
        .find(|balance| balance.item_id == seed_id)
    {
        balance.amount = balance
            .amount
            .checked_add(amount)
            .ok_or(GrowfiError::MathOverflow)?;
        return Ok(());
    }
    require!(
        inventory.balances.len() < MAX_SEED_BALANCES,
        GrowfiError::InventoryFull
    );
    inventory.balances.push(ItemBalance {
        item_id: seed_id,
        amount,
    });
    Ok(())
}

pub fn deduct_seed_balance(inventory: &mut SeedInventory, seed_id: u64, amount: u64) -> Result<()> {
    require!(amount > 0, GrowfiError::InvalidAmount);
    let balance = inventory
        .balances
        .iter_mut()
        .find(|balance| balance.item_id == seed_id)
        .ok_or(GrowfiError::InsufficientSeed)?;
    require!(balance.amount >= amount, GrowfiError::InsufficientSeed);
    balance.amount = balance
        .amount
        .checked_sub(amount)
        .ok_or(GrowfiError::MathOverflow)?;
    Ok(())
}

pub fn add_fruit_balance(
    inventory: &mut FruitInventory,
    fruit_id: u64,
    mutation: MutationKind,
    amount: u64,
) -> Result<()> {
    require!(amount > 0, GrowfiError::InvalidAmount);
    if let Some(balance) = inventory
        .balances
        .iter_mut()
        .find(|balance| balance.fruit_id == fruit_id && balance.mutation == mutation)
    {
        balance.amount = balance
            .amount
            .checked_add(amount)
            .ok_or(GrowfiError::MathOverflow)?;
        return Ok(());
    }
    require!(
        inventory.balances.len() < MAX_FRUIT_BALANCES,
        GrowfiError::InventoryFull
    );
    inventory.balances.push(FruitBalance {
        fruit_id,
        mutation,
        amount,
        locked_amount: 0,
    });
    Ok(())
}

pub fn fruit_balance_mut(
    inventory: &mut FruitInventory,
    fruit_id: u64,
    mutation: MutationKind,
) -> Result<&mut FruitBalance> {
    inventory
        .balances
        .iter_mut()
        .find(|balance| balance.fruit_id == fruit_id && balance.mutation == mutation)
        .ok_or(error!(GrowfiError::InsufficientFruit))
}

pub fn unlocked_fruit_amount(balance: &FruitBalance) -> Result<u64> {
    balance
        .amount
        .checked_sub(balance.locked_amount)
        .ok_or(error!(GrowfiError::FruitLocked))
}

pub fn add_decoration_balance(
    inventory: &mut DecorationInventory,
    decoration_id: u64,
    amount: u64,
) -> Result<()> {
    require!(amount > 0, GrowfiError::InvalidAmount);
    if let Some(balance) = inventory
        .balances
        .iter_mut()
        .find(|balance| balance.item_id == decoration_id)
    {
        balance.amount = balance
            .amount
            .checked_add(amount)
            .ok_or(GrowfiError::MathOverflow)?;
        return Ok(());
    }
    require!(
        inventory.balances.len() < MAX_DECORATION_BALANCES,
        GrowfiError::InventoryFull
    );
    inventory.balances.push(ItemBalance {
        item_id: decoration_id,
        amount,
    });
    Ok(())
}

pub fn require_decoration(inventory: &DecorationInventory, decoration_id: u64) -> Result<()> {
    let balance = inventory
        .balances
        .iter()
        .find(|balance| balance.item_id == decoration_id)
        .ok_or(error!(GrowfiError::InvalidAccountState))?;
    require!(balance.amount > 0, GrowfiError::InvalidAccountState);
    Ok(())
}

pub fn refresh_stamina(player: &mut Player, now: i64) -> Result<()> {
    if player.stamina >= player.max_stamina {
        player.last_stamina_update = now;
        return Ok(());
    }
    let elapsed = now
        .checked_sub(player.last_stamina_update)
        .ok_or(GrowfiError::MathOverflow)?;
    if elapsed <= 0 {
        return Ok(());
    }
    let regenerated = elapsed
        .checked_div(STAMINA_REGEN_SECONDS)
        .ok_or(GrowfiError::MathOverflow)? as u16;
    if regenerated == 0 {
        return Ok(());
    }
    let next = player.stamina.saturating_add(regenerated).min(player.max_stamina);
    let consumed = i64::from(next.saturating_sub(player.stamina))
        .checked_mul(STAMINA_REGEN_SECONDS)
        .ok_or(GrowfiError::MathOverflow)?;
    player.stamina = next;
    player.last_stamina_update = if player.stamina >= player.max_stamina {
        now
    } else {
        player
            .last_stamina_update
            .checked_add(consumed)
            .ok_or(GrowfiError::MathOverflow)?
    };
    Ok(())
}

pub fn consume_stamina(player: &mut Player, now: i64, amount: u16) -> Result<()> {
    refresh_stamina(player, now)?;
    require!(player.stamina >= amount, GrowfiError::InsufficientStamina);
    player.stamina = player
        .stamina
        .checked_sub(amount)
        .ok_or(GrowfiError::MathOverflow)?;
    player.last_stamina_update = now;
    Ok(())
}

pub fn farm_dimensions_for_level(level: u8) -> Result<(u8, u8, u64)> {
    match level {
        1 => Ok((4, 4, 0)),
        2 => Ok((5, 5, 250)),
        3 => Ok((6, 6, 750)),
        4 => Ok((8, 8, 2_000)),
        5 => Ok((10, 10, 5_000)),
        _ => err!(GrowfiError::InvalidAmount),
    }
}

pub fn mutation_multiplier_bps(mutation: MutationKind) -> u64 {
    match mutation {
        MutationKind::Normal => 10_000,
        MutationKind::Big => 15_000,
        MutationKind::Sweet => 20_000,
        MutationKind::Golden => 50_000,
        MutationKind::Crystal => 100_000,
        MutationKind::Rainbow => 500_000,
    }
}
