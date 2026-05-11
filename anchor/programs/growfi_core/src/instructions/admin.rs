use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::errors::GrowfiError;
use crate::events::ConfigUpdatedEvent;
use crate::state::*;

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + Config::INIT_SPACE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub grow_mint: InterfaceAccount<'info, Mint>,
    #[account(constraint = treasury_vault.mint == grow_mint.key() @ GrowfiError::InvalidMint)]
    pub treasury_vault: InterfaceAccount<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_config(
    ctx: Context<InitializeConfig>,
    marketplace_fee_bps: u16,
    trade_fee_bps: u16,
    creator_fee_bps: u16,
    burn_fee_bps: u16,
) -> Result<()> {
    require!(marketplace_fee_bps <= 10_000, GrowfiError::InvalidAmount);
    require!(trade_fee_bps <= 10_000, GrowfiError::InvalidAmount);
    require!(creator_fee_bps <= 10_000, GrowfiError::InvalidAmount);
    require!(burn_fee_bps <= 10_000, GrowfiError::InvalidAmount);

    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.grow_mint = ctx.accounts.grow_mint.key();
    config.treasury_vault = ctx.accounts.treasury_vault.key();
    config.marketplace_fee_bps = marketplace_fee_bps;
    config.trade_fee_bps = trade_fee_bps;
    config.creator_fee_bps = creator_fee_bps;
    config.burn_fee_bps = burn_fee_bps;
    config.paused = false;
    config.bump = ctx.bumps.config;

    emit!(ConfigUpdatedEvent {
        admin: config.admin,
        grow_mint: config.grow_mint,
        paused: config.paused,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    pub admin: Signer<'info>,
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
    assert_admin(&ctx.accounts.config, ctx.accounts.admin.key())?;
    require!(marketplace_fee_bps <= 10_000, GrowfiError::InvalidAmount);
    require!(trade_fee_bps <= 10_000, GrowfiError::InvalidAmount);
    require!(creator_fee_bps <= 10_000, GrowfiError::InvalidAmount);
    require!(burn_fee_bps <= 10_000, GrowfiError::InvalidAmount);

    let config = &mut ctx.accounts.config;
    config.admin = admin;
    config.treasury_vault = treasury_vault;
    config.marketplace_fee_bps = marketplace_fee_bps;
    config.trade_fee_bps = trade_fee_bps;
    config.creator_fee_bps = creator_fee_bps;
    config.burn_fee_bps = burn_fee_bps;

    emit!(ConfigUpdatedEvent {
        admin: config.admin,
        grow_mint: config.grow_mint,
        paused: config.paused,
    });
    Ok(())
}

pub fn set_pause(ctx: Context<UpdateConfig>, paused: bool) -> Result<()> {
    assert_admin(&ctx.accounts.config, ctx.accounts.admin.key())?;
    let config = &mut ctx.accounts.config;
    config.paused = paused;
    emit!(ConfigUpdatedEvent {
        admin: config.admin,
        grow_mint: config.grow_mint,
        paused,
    });
    Ok(())
}

#[derive(Accounts)]
#[instruction(seed_id: u64)]
pub struct CreateSeedCatalog<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        init,
        payer = admin,
        space = 8 + SeedCatalog::INIT_SPACE,
        seeds = [b"seed_catalog", seed_id.to_le_bytes().as_ref()],
        bump
    )]
    pub seed_catalog: Account<'info, SeedCatalog>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
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
    assert_admin(&ctx.accounts.config, ctx.accounts.admin.key())?;
    require!(seed_id > 0 && fruit_id > 0, GrowfiError::InvalidAmount);
    require!(price > 0 && grow_time_seconds > 0, GrowfiError::InvalidAmount);
    require!(min_yield > 0 && max_yield >= min_yield, GrowfiError::InvalidAmount);
    require!(max_harvests > 0, GrowfiError::InvalidAmount);
    require!(mutation_chance_bps <= 10_000, GrowfiError::InvalidAmount);

    let seed = &mut ctx.accounts.seed_catalog;
    seed.seed_id = seed_id;
    seed.fruit_id = fruit_id;
    seed.name_hash = name_hash;
    seed.rarity = rarity;
    seed.price = price;
    seed.grow_time_seconds = grow_time_seconds;
    seed.regrow_time_seconds = regrow_time_seconds;
    seed.min_yield = min_yield;
    seed.max_yield = max_yield;
    seed.max_harvests = max_harvests;
    seed.mutation_chance_bps = mutation_chance_bps;
    seed.required_garden_level = required_garden_level;
    seed.base_sell_price = base_sell_price;
    seed.active = true;
    seed.bump = ctx.bumps.seed_catalog;
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateSeedCatalog<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"seed_catalog", seed_catalog.seed_id.to_le_bytes().as_ref()], bump = seed_catalog.bump)]
    pub seed_catalog: Account<'info, SeedCatalog>,
    pub admin: Signer<'info>,
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
    assert_admin(&ctx.accounts.config, ctx.accounts.admin.key())?;
    require!(price > 0 && grow_time_seconds > 0, GrowfiError::InvalidAmount);
    require!(min_yield > 0 && max_yield >= min_yield, GrowfiError::InvalidAmount);
    require!(max_harvests > 0, GrowfiError::InvalidAmount);
    require!(mutation_chance_bps <= 10_000, GrowfiError::InvalidAmount);

    let seed = &mut ctx.accounts.seed_catalog;
    seed.price = price;
    seed.grow_time_seconds = grow_time_seconds;
    seed.regrow_time_seconds = regrow_time_seconds;
    seed.min_yield = min_yield;
    seed.max_yield = max_yield;
    seed.max_harvests = max_harvests;
    seed.mutation_chance_bps = mutation_chance_bps;
    seed.required_garden_level = required_garden_level;
    seed.base_sell_price = base_sell_price;
    seed.active = active;
    Ok(())
}

#[derive(Accounts)]
#[instruction(rotation_id: u64)]
pub struct CreateShopRotation<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        init,
        payer = admin,
        space = 8 + ShopRotation::INIT_SPACE,
        seeds = [b"shop_rotation", rotation_id.to_le_bytes().as_ref()],
        bump
    )]
    pub shop_rotation: Account<'info, ShopRotation>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn create_shop_rotation(
    ctx: Context<CreateShopRotation>,
    rotation_id: u64,
    starts_at: i64,
    ends_at: i64,
) -> Result<()> {
    assert_admin(&ctx.accounts.config, ctx.accounts.admin.key())?;
    require!(rotation_id > 0 && ends_at > starts_at, GrowfiError::InvalidAmount);
    let rotation = &mut ctx.accounts.shop_rotation;
    rotation.rotation_id = rotation_id;
    rotation.starts_at = starts_at;
    rotation.ends_at = ends_at;
    rotation.bump = ctx.bumps.shop_rotation;
    Ok(())
}

#[derive(Accounts)]
#[instruction(rotation_id: u64, seed_id: u64)]
pub struct CreateShopItem<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(seeds = [b"shop_rotation", rotation_id.to_le_bytes().as_ref()], bump = shop_rotation.bump)]
    pub shop_rotation: Account<'info, ShopRotation>,
    #[account(seeds = [b"seed_catalog", seed_id.to_le_bytes().as_ref()], bump = seed_catalog.bump)]
    pub seed_catalog: Account<'info, SeedCatalog>,
    #[account(
        init,
        payer = admin,
        space = 8 + ShopItem::INIT_SPACE,
        seeds = [b"shop_item", rotation_id.to_le_bytes().as_ref(), seed_id.to_le_bytes().as_ref()],
        bump
    )]
    pub shop_item: Account<'info, ShopItem>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn create_shop_item(
    ctx: Context<CreateShopItem>,
    rotation_id: u64,
    seed_id: u64,
    price: u64,
    stock_total: u64,
    max_buy_per_user: u64,
) -> Result<()> {
    assert_admin(&ctx.accounts.config, ctx.accounts.admin.key())?;
    require!(ctx.accounts.seed_catalog.seed_id == seed_id, GrowfiError::InvalidAccountState);
    require!(price > 0 && stock_total > 0 && max_buy_per_user > 0, GrowfiError::InvalidAmount);
    let item = &mut ctx.accounts.shop_item;
    item.rotation_id = rotation_id;
    item.seed_id = seed_id;
    item.price = price;
    item.stock_total = stock_total;
    item.stock_remaining = stock_total;
    item.max_buy_per_user = max_buy_per_user;
    item.bump = ctx.bumps.shop_item;
    Ok(())
}
