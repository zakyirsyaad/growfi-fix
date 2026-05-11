use anchor_lang::prelude::*;
use anchor_spl::token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::errors::GrowfiError;
use crate::events::SeedBoughtEvent;
use crate::state::*;

#[derive(Accounts)]
#[instruction(rotation_id: u64, seed_id: u64)]
pub struct BuySeed<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"player", buyer.key().as_ref()], bump = player.bump)]
    pub player: Box<Account<'info, Player>>,
    #[account(mut, seeds = [b"seed_inventory", buyer.key().as_ref()], bump = seed_inventory.bump)]
    pub seed_inventory: Box<Account<'info, SeedInventory>>,
    #[account(seeds = [b"shop_rotation", rotation_id.to_le_bytes().as_ref()], bump = shop_rotation.bump)]
    pub shop_rotation: Box<Account<'info, ShopRotation>>,
    #[account(
        mut,
        seeds = [b"shop_item", rotation_id.to_le_bytes().as_ref(), seed_id.to_le_bytes().as_ref()],
        bump = shop_item.bump
    )]
    pub shop_item: Box<Account<'info, ShopItem>>,
    #[account(seeds = [b"seed_catalog", seed_id.to_le_bytes().as_ref()], bump = seed_catalog.bump)]
    pub seed_catalog: Box<Account<'info, SeedCatalog>>,
    #[account(
        init_if_needed,
        payer = buyer,
        space = 8 + ShopPurchase::INIT_SPACE,
        seeds = [b"shop_purchase", buyer.key().as_ref(), rotation_id.to_le_bytes().as_ref(), seed_id.to_le_bytes().as_ref()],
        bump
    )]
    pub shop_purchase: Box<Account<'info, ShopPurchase>>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut, constraint = grow_mint.key() == config.grow_mint @ GrowfiError::InvalidMint)]
    pub grow_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, constraint = buyer_grow_ata.mint == grow_mint.key() @ GrowfiError::InvalidMint, constraint = buyer_grow_ata.owner == buyer.key() @ GrowfiError::Unauthorized)]
    pub buyer_grow_ata: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, constraint = treasury_vault.key() == config.treasury_vault @ GrowfiError::InvalidAccountState)]
    pub treasury_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn buy_seed(
    ctx: Context<BuySeed>,
    rotation_id: u64,
    seed_id: u64,
    quantity: u64,
) -> Result<()> {
    assert_not_paused(&ctx.accounts.config)?;
    let now = Clock::get()?.unix_timestamp;
    require!(quantity > 0, GrowfiError::InvalidAmount);
    require!(ctx.accounts.shop_rotation.rotation_id == rotation_id, GrowfiError::InvalidAccountState);
    require!(
        now >= ctx.accounts.shop_rotation.starts_at && now < ctx.accounts.shop_rotation.ends_at,
        GrowfiError::ShopExpired
    );
    require!(ctx.accounts.shop_item.seed_id == seed_id, GrowfiError::InvalidAccountState);
    require!(ctx.accounts.seed_catalog.active, GrowfiError::InvalidAccountState);
    require!(
        ctx.accounts.shop_item.stock_remaining >= quantity,
        GrowfiError::ShopOutOfStock
    );

    let purchase = &mut ctx.accounts.shop_purchase;
    if purchase.buyer == Pubkey::default() {
        purchase.buyer = ctx.accounts.buyer.key();
        purchase.rotation_id = rotation_id;
        purchase.seed_id = seed_id;
        purchase.amount_bought = 0;
        purchase.bump = ctx.bumps.shop_purchase;
    }

    let next_bought = purchase
        .amount_bought
        .checked_add(quantity)
        .ok_or(GrowfiError::MathOverflow)?;
    require!(
        next_bought <= ctx.accounts.shop_item.max_buy_per_user,
        GrowfiError::MaxBuyReached
    );

    let total_price = ctx
        .accounts
        .shop_item
        .price
        .checked_mul(quantity)
        .ok_or(GrowfiError::MathOverflow)?;

    let cpi_accounts = TransferChecked {
        from: ctx.accounts.buyer_grow_ata.to_account_info(),
        mint: ctx.accounts.grow_mint.to_account_info(),
        to: ctx.accounts.treasury_vault.to_account_info(),
        authority: ctx.accounts.buyer.to_account_info(),
    };
    transfer_checked(
        CpiContext::new(ctx.accounts.token_program.key(), cpi_accounts),
        total_price,
        ctx.accounts.grow_mint.decimals,
    )?;

    ctx.accounts.shop_item.stock_remaining = ctx
        .accounts
        .shop_item
        .stock_remaining
        .checked_sub(quantity)
        .ok_or(GrowfiError::MathOverflow)?;
    purchase.amount_bought = next_bought;
    add_seed_balance(&mut ctx.accounts.seed_inventory, seed_id, quantity)?;

    emit!(SeedBoughtEvent {
        buyer: ctx.accounts.buyer.key(),
        seed_id,
        quantity,
        total_price,
    });
    Ok(())
}
