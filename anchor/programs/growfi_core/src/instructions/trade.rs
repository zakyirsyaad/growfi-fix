use anchor_lang::prelude::*;
use anchor_spl::token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::errors::GrowfiError;
use crate::events::{TradeCompletedEvent, TradeCreatedEvent};
use crate::state::*;

#[derive(Accounts)]
#[instruction(trade_id: u64)]
pub struct CreateTrade<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        init,
        payer = initiator,
        space = 8 + Trade::INIT_SPACE,
        seeds = [b"trade", initiator.key().as_ref(), recipient.key().as_ref(), trade_id.to_le_bytes().as_ref()],
        bump
    )]
    pub trade: Box<Account<'info, Trade>>,
    #[account(mut)]
    pub initiator: Signer<'info>,
    /// CHECK: Recipient is stored in the trade PDA.
    pub recipient: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn create_trade(ctx: Context<CreateTrade>, trade_id: u64, expires_at: i64) -> Result<()> {
    assert_not_paused(&ctx.accounts.config)?;
    require!(trade_id > 0, GrowfiError::InvalidAmount);
    require!(expires_at > Clock::get()?.unix_timestamp, GrowfiError::TradeExpired);
    require!(ctx.accounts.initiator.key() != ctx.accounts.recipient.key(), GrowfiError::InvalidTradeState);

    let trade = &mut ctx.accounts.trade;
    trade.trade_id = trade_id;
    trade.initiator = ctx.accounts.initiator.key();
    trade.recipient = ctx.accounts.recipient.key();
    trade.status = TradeStatus::Pending;
    trade.initiator_confirmed = false;
    trade.recipient_confirmed = false;
    trade.initiator_grow_amount = 0;
    trade.recipient_grow_amount = 0;
    trade.initiator_items = Vec::new();
    trade.recipient_items = Vec::new();
    trade.expires_at = expires_at;
    trade.bump = ctx.bumps.trade;

    emit!(TradeCreatedEvent {
        trade: trade.key(),
        initiator: trade.initiator,
        recipient: trade.recipient,
        expires_at,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateTradeOffer<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"trade", trade.initiator.as_ref(), trade.recipient.as_ref(), trade.trade_id.to_le_bytes().as_ref()], bump = trade.bump)]
    pub trade: Box<Account<'info, Trade>>,
    #[account(mut, seeds = [b"fruit_inventory", authority.key().as_ref()], bump = fruit_inventory.bump)]
    pub fruit_inventory: Account<'info, FruitInventory>,
    pub authority: Signer<'info>,
}

pub fn update_trade_offer(
    ctx: Context<UpdateTradeOffer>,
    grow_amount: u64,
    items: Vec<TradeItem>,
) -> Result<()> {
    assert_not_paused(&ctx.accounts.config)?;
    require!(items.len() <= MAX_TRADE_ITEMS, GrowfiError::InvalidAmount);
    require!(
        matches!(ctx.accounts.trade.status, TradeStatus::Pending | TradeStatus::Active | TradeStatus::Locked),
        GrowfiError::InvalidTradeState
    );
    require!(ctx.accounts.trade.expires_at > Clock::get()?.unix_timestamp, GrowfiError::TradeExpired);

    let is_initiator = ctx.accounts.authority.key() == ctx.accounts.trade.initiator;
    let is_recipient = ctx.accounts.authority.key() == ctx.accounts.trade.recipient;
    require!(is_initiator || is_recipient, GrowfiError::Unauthorized);

    let old_items = if is_initiator {
        ctx.accounts.trade.initiator_items.clone()
    } else {
        ctx.accounts.trade.recipient_items.clone()
    };
    unlock_trade_items(&mut ctx.accounts.fruit_inventory, &old_items)?;
    lock_trade_items(&mut ctx.accounts.fruit_inventory, &items)?;

    if is_initiator {
        ctx.accounts.trade.initiator_items = items;
        ctx.accounts.trade.initiator_grow_amount = grow_amount;
    } else {
        ctx.accounts.trade.recipient_items = items;
        ctx.accounts.trade.recipient_grow_amount = grow_amount;
    }
    ctx.accounts.trade.initiator_confirmed = false;
    ctx.accounts.trade.recipient_confirmed = false;
    ctx.accounts.trade.status = TradeStatus::Active;
    Ok(())
}

#[derive(Accounts)]
pub struct ConfirmTrade<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"trade", trade.initiator.as_ref(), trade.recipient.as_ref(), trade.trade_id.to_le_bytes().as_ref()], bump = trade.bump)]
    pub trade: Account<'info, Trade>,
    pub authority: Signer<'info>,
}

pub fn confirm_trade(ctx: Context<ConfirmTrade>) -> Result<()> {
    assert_not_paused(&ctx.accounts.config)?;
    require!(
        matches!(ctx.accounts.trade.status, TradeStatus::Pending | TradeStatus::Active | TradeStatus::Locked),
        GrowfiError::InvalidTradeState
    );
    require!(ctx.accounts.trade.expires_at > Clock::get()?.unix_timestamp, GrowfiError::TradeExpired);
    let authority = ctx.accounts.authority.key();
    if authority == ctx.accounts.trade.initiator {
        ctx.accounts.trade.initiator_confirmed = true;
    } else if authority == ctx.accounts.trade.recipient {
        ctx.accounts.trade.recipient_confirmed = true;
    } else {
        return err!(GrowfiError::Unauthorized);
    }
    ctx.accounts.trade.status = TradeStatus::Locked;
    Ok(())
}

#[derive(Accounts)]
pub struct CancelTrade<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"trade", trade.initiator.as_ref(), trade.recipient.as_ref(), trade.trade_id.to_le_bytes().as_ref()], bump = trade.bump)]
    pub trade: Account<'info, Trade>,
    #[account(mut, seeds = [b"fruit_inventory", trade.initiator.as_ref()], bump = initiator_fruit_inventory.bump)]
    pub initiator_fruit_inventory: Box<Account<'info, FruitInventory>>,
    #[account(mut, seeds = [b"fruit_inventory", trade.recipient.as_ref()], bump = recipient_fruit_inventory.bump)]
    pub recipient_fruit_inventory: Box<Account<'info, FruitInventory>>,
    pub authority: Signer<'info>,
}

pub fn cancel_trade(ctx: Context<CancelTrade>) -> Result<()> {
    assert_not_paused(&ctx.accounts.config)?;
    let authority = ctx.accounts.authority.key();
    require!(
        authority == ctx.accounts.trade.initiator || authority == ctx.accounts.trade.recipient,
        GrowfiError::Unauthorized
    );
    require!(
        matches!(ctx.accounts.trade.status, TradeStatus::Pending | TradeStatus::Active | TradeStatus::Locked),
        GrowfiError::InvalidTradeState
    );
    unlock_trade_items(
        &mut ctx.accounts.initiator_fruit_inventory,
        &ctx.accounts.trade.initiator_items,
    )?;
    unlock_trade_items(
        &mut ctx.accounts.recipient_fruit_inventory,
        &ctx.accounts.trade.recipient_items,
    )?;
    ctx.accounts.trade.status = TradeStatus::Cancelled;
    ctx.accounts.trade.initiator_confirmed = false;
    ctx.accounts.trade.recipient_confirmed = false;
    Ok(())
}

#[derive(Accounts)]
pub struct CompleteTrade<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"trade", trade.initiator.as_ref(), trade.recipient.as_ref(), trade.trade_id.to_le_bytes().as_ref()], bump = trade.bump)]
    pub trade: Box<Account<'info, Trade>>,
    #[account(mut, seeds = [b"fruit_inventory", trade.initiator.as_ref()], bump = initiator_fruit_inventory.bump)]
    pub initiator_fruit_inventory: Box<Account<'info, FruitInventory>>,
    #[account(mut, seeds = [b"fruit_inventory", trade.recipient.as_ref()], bump = recipient_fruit_inventory.bump)]
    pub recipient_fruit_inventory: Box<Account<'info, FruitInventory>>,
    #[account(mut, address = trade.initiator @ GrowfiError::Unauthorized)]
    pub initiator: Signer<'info>,
    #[account(mut, address = trade.recipient @ GrowfiError::Unauthorized)]
    pub recipient: Signer<'info>,
    #[account(mut, constraint = grow_mint.key() == config.grow_mint @ GrowfiError::InvalidMint)]
    pub grow_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, constraint = initiator_grow_ata.mint == grow_mint.key() @ GrowfiError::InvalidMint, constraint = initiator_grow_ata.owner == initiator.key() @ GrowfiError::Unauthorized)]
    pub initiator_grow_ata: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, constraint = recipient_grow_ata.mint == grow_mint.key() @ GrowfiError::InvalidMint, constraint = recipient_grow_ata.owner == recipient.key() @ GrowfiError::Unauthorized)]
    pub recipient_grow_ata: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, constraint = treasury_vault.key() == config.treasury_vault @ GrowfiError::InvalidAccountState)]
    pub treasury_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn complete_trade(ctx: Context<CompleteTrade>) -> Result<()> {
    assert_not_paused(&ctx.accounts.config)?;
    require!(ctx.accounts.trade.status == TradeStatus::Locked, GrowfiError::InvalidTradeState);
    require!(ctx.accounts.trade.expires_at > Clock::get()?.unix_timestamp, GrowfiError::TradeExpired);
    require!(
        ctx.accounts.trade.initiator_confirmed && ctx.accounts.trade.recipient_confirmed,
        GrowfiError::TradeNotConfirmed
    );

    move_trade_items(
        &mut ctx.accounts.initiator_fruit_inventory,
        &mut ctx.accounts.recipient_fruit_inventory,
        &ctx.accounts.trade.initiator_items,
    )?;
    move_trade_items(
        &mut ctx.accounts.recipient_fruit_inventory,
        &mut ctx.accounts.initiator_fruit_inventory,
        &ctx.accounts.trade.recipient_items,
    )?;

    transfer_trade_grow(
        ctx.accounts.trade.initiator_grow_amount,
        ctx.accounts.config.trade_fee_bps,
        &ctx.accounts.initiator.to_account_info(),
        &ctx.accounts.initiator_grow_ata.to_account_info(),
        &ctx.accounts.recipient_grow_ata.to_account_info(),
        &ctx.accounts.treasury_vault.to_account_info(),
        &ctx.accounts.grow_mint,
        &ctx.accounts.token_program,
    )?;
    transfer_trade_grow(
        ctx.accounts.trade.recipient_grow_amount,
        ctx.accounts.config.trade_fee_bps,
        &ctx.accounts.recipient.to_account_info(),
        &ctx.accounts.recipient_grow_ata.to_account_info(),
        &ctx.accounts.initiator_grow_ata.to_account_info(),
        &ctx.accounts.treasury_vault.to_account_info(),
        &ctx.accounts.grow_mint,
        &ctx.accounts.token_program,
    )?;

    ctx.accounts.trade.status = TradeStatus::Completed;
    emit!(TradeCompletedEvent {
        trade: ctx.accounts.trade.key(),
        initiator: ctx.accounts.trade.initiator,
        recipient: ctx.accounts.trade.recipient,
        status: ctx.accounts.trade.status,
    });
    Ok(())
}

fn lock_trade_items(inventory: &mut FruitInventory, items: &[TradeItem]) -> Result<()> {
    for item in items {
        require!(item.quantity > 0, GrowfiError::InvalidAmount);
        let balance = fruit_balance_mut(inventory, item.fruit_id, item.mutation)?;
        require!(unlocked_fruit_amount(balance)? >= item.quantity, GrowfiError::InsufficientFruit);
        balance.locked_amount = balance
            .locked_amount
            .checked_add(item.quantity)
            .ok_or(GrowfiError::MathOverflow)?;
    }
    Ok(())
}

fn unlock_trade_items(inventory: &mut FruitInventory, items: &[TradeItem]) -> Result<()> {
    for item in items {
        let balance = fruit_balance_mut(inventory, item.fruit_id, item.mutation)?;
        balance.locked_amount = balance.locked_amount.saturating_sub(item.quantity);
    }
    Ok(())
}

fn move_trade_items(from: &mut FruitInventory, to: &mut FruitInventory, items: &[TradeItem]) -> Result<()> {
    for item in items {
        let balance = fruit_balance_mut(from, item.fruit_id, item.mutation)?;
        require!(
            balance.amount >= item.quantity && balance.locked_amount >= item.quantity,
            GrowfiError::InsufficientFruit
        );
        balance.amount = balance
            .amount
            .checked_sub(item.quantity)
            .ok_or(GrowfiError::MathOverflow)?;
        balance.locked_amount = balance
            .locked_amount
            .checked_sub(item.quantity)
            .ok_or(GrowfiError::MathOverflow)?;
        add_fruit_balance(to, item.fruit_id, item.mutation, item.quantity)?;
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn transfer_trade_grow<'info>(
    amount: u64,
    fee_bps: u16,
    authority: &AccountInfo<'info>,
    from: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    treasury: &AccountInfo<'info>,
    mint: &InterfaceAccount<'info, Mint>,
    token_program: &Interface<'info, TokenInterface>,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    let fee = amount
        .checked_mul(u64::from(fee_bps))
        .and_then(|value| value.checked_div(10_000))
        .ok_or(GrowfiError::MathOverflow)?;
    let payout = amount.checked_sub(fee).ok_or(GrowfiError::MathOverflow)?;
    if payout > 0 {
        transfer_checked(
            CpiContext::new(token_program.key(),
                TransferChecked {
                    from: from.clone(),
                    mint: mint.to_account_info(),
                    to: to.clone(),
                    authority: authority.clone(),
                },
            ),
            payout,
            mint.decimals,
        )?;
    }
    if fee > 0 {
        transfer_checked(
            CpiContext::new(token_program.key(),
                TransferChecked {
                    from: from.clone(),
                    mint: mint.to_account_info(),
                    to: treasury.clone(),
                    authority: authority.clone(),
                },
            ),
            fee,
            mint.decimals,
        )?;
    }
    Ok(())
}
