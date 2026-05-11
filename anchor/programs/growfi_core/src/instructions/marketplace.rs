use anchor_lang::prelude::*;
use anchor_spl::token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::errors::GrowfiError;
use crate::events::{ListingBoughtEvent, ListingCancelledEvent, ListingCreatedEvent};
use crate::state::*;

#[derive(Accounts)]
#[instruction(listing_id: u64)]
pub struct CreateListing<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"fruit_inventory", seller.key().as_ref()], bump = fruit_inventory.bump)]
    pub fruit_inventory: Account<'info, FruitInventory>,
    #[account(
        init,
        payer = seller,
        space = 8 + MarketplaceListing::INIT_SPACE,
        seeds = [b"listing", seller.key().as_ref(), listing_id.to_le_bytes().as_ref()],
        bump
    )]
    pub listing: Account<'info, MarketplaceListing>,
    #[account(mut)]
    pub seller: Signer<'info>,
    pub system_program: Program<'info, System>,
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
    assert_not_paused(&ctx.accounts.config)?;
    require!(listing_id > 0 && quantity > 0 && price > 0, GrowfiError::InvalidAmount);
    require!(expires_at > Clock::get()?.unix_timestamp, GrowfiError::ListingExpired);

    let balance = fruit_balance_mut(&mut ctx.accounts.fruit_inventory, fruit_id, mutation)?;
    require!(unlocked_fruit_amount(balance)? >= quantity, GrowfiError::InsufficientFruit);
    balance.locked_amount = balance
        .locked_amount
        .checked_add(quantity)
        .ok_or(GrowfiError::MathOverflow)?;

    let listing = &mut ctx.accounts.listing;
    listing.listing_id = listing_id;
    listing.seller = ctx.accounts.seller.key();
    listing.fruit_id = fruit_id;
    listing.mutation = mutation;
    listing.quantity = quantity;
    listing.price = price;
    listing.status = ListingStatus::Active;
    listing.created_at = Clock::get()?.unix_timestamp;
    listing.expires_at = expires_at;
    listing.bump = ctx.bumps.listing;

    emit!(ListingCreatedEvent {
        listing: listing.key(),
        seller: listing.seller,
        fruit_id,
        mutation,
        quantity,
        price,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct CancelListing<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"fruit_inventory", seller.key().as_ref()], bump = fruit_inventory.bump)]
    pub fruit_inventory: Account<'info, FruitInventory>,
    #[account(mut, seeds = [b"listing", seller.key().as_ref(), listing.listing_id.to_le_bytes().as_ref()], bump = listing.bump)]
    pub listing: Box<Account<'info, MarketplaceListing>>,
    #[account(mut)]
    pub seller: Signer<'info>,
}

pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
    assert_not_paused(&ctx.accounts.config)?;
    require_keys_eq!(ctx.accounts.listing.seller, ctx.accounts.seller.key(), GrowfiError::Unauthorized);
    require!(ctx.accounts.listing.status == ListingStatus::Active, GrowfiError::ListingInactive);
    let balance = fruit_balance_mut(
        &mut ctx.accounts.fruit_inventory,
        ctx.accounts.listing.fruit_id,
        ctx.accounts.listing.mutation,
    )?;
    balance.locked_amount = balance.locked_amount.saturating_sub(ctx.accounts.listing.quantity);
    ctx.accounts.listing.status = ListingStatus::Cancelled;
    emit!(ListingCancelledEvent {
        listing: ctx.accounts.listing.key(),
        seller: ctx.accounts.seller.key(),
    });
    Ok(())
}

#[derive(Accounts)]
pub struct BuyListing<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"listing", listing.seller.as_ref(), listing.listing_id.to_le_bytes().as_ref()], bump = listing.bump)]
    pub listing: Box<Account<'info, MarketplaceListing>>,
    #[account(mut, seeds = [b"fruit_inventory", listing.seller.as_ref()], bump = seller_fruit_inventory.bump)]
    pub seller_fruit_inventory: Box<Account<'info, FruitInventory>>,
    #[account(mut, seeds = [b"fruit_inventory", buyer.key().as_ref()], bump = buyer_fruit_inventory.bump)]
    pub buyer_fruit_inventory: Box<Account<'info, FruitInventory>>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    /// CHECK: Seller is stored on the listing and validated by token account owner.
    pub seller: UncheckedAccount<'info>,
    #[account(mut, constraint = grow_mint.key() == config.grow_mint @ GrowfiError::InvalidMint)]
    pub grow_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, constraint = buyer_grow_ata.mint == grow_mint.key() @ GrowfiError::InvalidMint, constraint = buyer_grow_ata.owner == buyer.key() @ GrowfiError::Unauthorized)]
    pub buyer_grow_ata: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, constraint = seller_grow_ata.mint == grow_mint.key() @ GrowfiError::InvalidMint, constraint = seller_grow_ata.owner == listing.seller @ GrowfiError::Unauthorized)]
    pub seller_grow_ata: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, constraint = treasury_vault.key() == config.treasury_vault @ GrowfiError::InvalidAccountState)]
    pub treasury_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn buy_listing(ctx: Context<BuyListing>) -> Result<()> {
    assert_not_paused(&ctx.accounts.config)?;
    let now = Clock::get()?.unix_timestamp;
    require_keys_eq!(ctx.accounts.seller.key(), ctx.accounts.listing.seller, GrowfiError::Unauthorized);
    require!(ctx.accounts.listing.status == ListingStatus::Active, GrowfiError::ListingInactive);
    require!(ctx.accounts.listing.expires_at > now, GrowfiError::ListingExpired);
    require!(ctx.accounts.buyer.key() != ctx.accounts.listing.seller, GrowfiError::Unauthorized);

    let price = ctx.accounts.listing.price;
    let fee = price
        .checked_mul(u64::from(ctx.accounts.config.marketplace_fee_bps))
        .and_then(|value| value.checked_div(10_000))
        .ok_or(GrowfiError::MathOverflow)?;
    let seller_payout = price.checked_sub(fee).ok_or(GrowfiError::MathOverflow)?;

    let seller_balance = fruit_balance_mut(
        &mut ctx.accounts.seller_fruit_inventory,
        ctx.accounts.listing.fruit_id,
        ctx.accounts.listing.mutation,
    )?;
    require!(
        seller_balance.locked_amount >= ctx.accounts.listing.quantity
            && seller_balance.amount >= ctx.accounts.listing.quantity,
        GrowfiError::InsufficientFruit
    );
    seller_balance.amount = seller_balance
        .amount
        .checked_sub(ctx.accounts.listing.quantity)
        .ok_or(GrowfiError::MathOverflow)?;
    seller_balance.locked_amount = seller_balance
        .locked_amount
        .checked_sub(ctx.accounts.listing.quantity)
        .ok_or(GrowfiError::MathOverflow)?;
    add_fruit_balance(
        &mut ctx.accounts.buyer_fruit_inventory,
        ctx.accounts.listing.fruit_id,
        ctx.accounts.listing.mutation,
        ctx.accounts.listing.quantity,
    )?;

    if seller_payout > 0 {
        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.buyer_grow_ata.to_account_info(),
                    mint: ctx.accounts.grow_mint.to_account_info(),
                    to: ctx.accounts.seller_grow_ata.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            seller_payout,
            ctx.accounts.grow_mint.decimals,
        )?;
    }
    if fee > 0 {
        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.buyer_grow_ata.to_account_info(),
                    mint: ctx.accounts.grow_mint.to_account_info(),
                    to: ctx.accounts.treasury_vault.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            fee,
            ctx.accounts.grow_mint.decimals,
        )?;
    }

    ctx.accounts.listing.status = ListingStatus::Sold;
    emit!(ListingBoughtEvent {
        listing: ctx.accounts.listing.key(),
        buyer: ctx.accounts.buyer.key(),
        seller: ctx.accounts.listing.seller,
        price,
        fee,
    });
    Ok(())
}
