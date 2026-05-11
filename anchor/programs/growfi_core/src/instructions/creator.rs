use anchor_lang::prelude::*;
use anchor_spl::token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::errors::GrowfiError;
use crate::events::{CreatorEnabledEvent, CreatorTippedEvent};
use crate::state::*;

#[derive(Accounts)]
pub struct EnableCreator<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        init,
        payer = owner,
        space = 8 + CreatorProfile::INIT_SPACE,
        seeds = [b"creator", owner.key().as_ref()],
        bump
    )]
    pub creator: Account<'info, CreatorProfile>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn enable_creator(ctx: Context<EnableCreator>, profile_hash: [u8; 32]) -> Result<()> {
    assert_not_paused(&ctx.accounts.config)?;
    let creator = &mut ctx.accounts.creator;
    creator.owner = ctx.accounts.owner.key();
    creator.active = true;
    creator.profile_hash = profile_hash;
    creator.total_visits = 0;
    creator.total_likes = 0;
    creator.total_earnings = 0;
    creator.bump = ctx.bumps.creator;
    emit!(CreatorEnabledEvent {
        owner: creator.owner,
        creator: creator.key(),
    });
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateCreatorProfileHash<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"creator", owner.key().as_ref()], bump = creator.bump)]
    pub creator: Account<'info, CreatorProfile>,
    pub owner: Signer<'info>,
}

pub fn update_creator_profile_hash(
    ctx: Context<UpdateCreatorProfileHash>,
    profile_hash: [u8; 32],
) -> Result<()> {
    assert_not_paused(&ctx.accounts.config)?;
    require_keys_eq!(ctx.accounts.creator.owner, ctx.accounts.owner.key(), GrowfiError::Unauthorized);
    ctx.accounts.creator.profile_hash = profile_hash;
    ctx.accounts.creator.active = true;
    Ok(())
}

#[derive(Accounts)]
pub struct LikeFarm<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"farm", farm.owner.as_ref()], bump = farm.bump)]
    pub farm: Account<'info, Farm>,
    #[account(mut, seeds = [b"creator", farm.owner.as_ref()], bump = creator.bump)]
    pub creator: Account<'info, CreatorProfile>,
    pub liker: Signer<'info>,
}

pub fn like_farm(ctx: Context<LikeFarm>) -> Result<()> {
    assert_not_paused(&ctx.accounts.config)?;
    ctx.accounts.farm.total_likes = ctx
        .accounts
        .farm
        .total_likes
        .checked_add(1)
        .ok_or(GrowfiError::MathOverflow)?;
    ctx.accounts.creator.total_likes = ctx
        .accounts
        .creator
        .total_likes
        .checked_add(1)
        .ok_or(GrowfiError::MathOverflow)?;
    Ok(())
}

#[derive(Accounts)]
pub struct TipCreator<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"creator", creator_owner.key().as_ref()], bump = creator.bump)]
    pub creator: Account<'info, CreatorProfile>,
    #[account(mut)]
    pub tipper: Signer<'info>,
    /// CHECK: Creator owner is validated through the creator PDA and token account owner.
    pub creator_owner: UncheckedAccount<'info>,
    #[account(mut, constraint = grow_mint.key() == config.grow_mint @ GrowfiError::InvalidMint)]
    pub grow_mint: InterfaceAccount<'info, Mint>,
    #[account(mut, constraint = tipper_grow_ata.mint == grow_mint.key() @ GrowfiError::InvalidMint, constraint = tipper_grow_ata.owner == tipper.key() @ GrowfiError::Unauthorized)]
    pub tipper_grow_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, constraint = creator_grow_ata.mint == grow_mint.key() @ GrowfiError::InvalidMint, constraint = creator_grow_ata.owner == creator.owner @ GrowfiError::Unauthorized)]
    pub creator_grow_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, constraint = treasury_vault.key() == config.treasury_vault @ GrowfiError::InvalidAccountState)]
    pub treasury_vault: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn tip_creator(ctx: Context<TipCreator>, amount: u64) -> Result<()> {
    assert_not_paused(&ctx.accounts.config)?;
    require!(amount > 0, GrowfiError::InvalidAmount);
    require!(ctx.accounts.creator.active, GrowfiError::InvalidAccountState);
    require_keys_eq!(ctx.accounts.creator.owner, ctx.accounts.creator_owner.key(), GrowfiError::Unauthorized);

    let fee = amount
        .checked_mul(u64::from(ctx.accounts.config.creator_fee_bps))
        .and_then(|value| value.checked_div(10_000))
        .ok_or(GrowfiError::MathOverflow)?;
    let payout = amount.checked_sub(fee).ok_or(GrowfiError::MathOverflow)?;

    if payout > 0 {
        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.tipper_grow_ata.to_account_info(),
                    mint: ctx.accounts.grow_mint.to_account_info(),
                    to: ctx.accounts.creator_grow_ata.to_account_info(),
                    authority: ctx.accounts.tipper.to_account_info(),
                },
            ),
            payout,
            ctx.accounts.grow_mint.decimals,
        )?;
    }
    if fee > 0 {
        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.tipper_grow_ata.to_account_info(),
                    mint: ctx.accounts.grow_mint.to_account_info(),
                    to: ctx.accounts.treasury_vault.to_account_info(),
                    authority: ctx.accounts.tipper.to_account_info(),
                },
            ),
            fee,
            ctx.accounts.grow_mint.decimals,
        )?;
    }
    ctx.accounts.creator.total_earnings = ctx
        .accounts
        .creator
        .total_earnings
        .checked_add(payout)
        .ok_or(GrowfiError::MathOverflow)?;

    emit!(CreatorTippedEvent {
        tipper: ctx.accounts.tipper.key(),
        creator: ctx.accounts.creator.key(),
        amount,
        fee,
    });
    Ok(())
}
