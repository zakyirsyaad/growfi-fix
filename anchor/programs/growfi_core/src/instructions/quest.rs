use anchor_lang::prelude::*;
use anchor_spl::token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::errors::GrowfiError;
use crate::events::{ChallengeJoinedEvent, ChallengeRewardClaimedEvent};
use crate::state::*;

#[derive(Accounts)]
#[instruction(challenge_id: u64)]
pub struct CreateChallenge<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        init,
        payer = creator,
        space = 8 + Challenge::INIT_SPACE,
        seeds = [b"challenge", creator.key().as_ref(), challenge_id.to_le_bytes().as_ref()],
        bump
    )]
    pub challenge: Account<'info, Challenge>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
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
    assert_not_paused(&ctx.accounts.config)?;
    require!(challenge_id > 0 && target > 0 && ends_at > starts_at, GrowfiError::InvalidAmount);
    let challenge = &mut ctx.accounts.challenge;
    challenge.challenge_id = challenge_id;
    challenge.creator = ctx.accounts.creator.key();
    challenge.objective_type = objective_type;
    challenge.target = target;
    challenge.reward_grow = reward_grow;
    challenge.starts_at = starts_at;
    challenge.ends_at = ends_at;
    challenge.active = true;
    challenge.bump = ctx.bumps.challenge;
    Ok(())
}

#[derive(Accounts)]
pub struct JoinChallenge<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(seeds = [b"challenge", challenge.creator.as_ref(), challenge.challenge_id.to_le_bytes().as_ref()], bump = challenge.bump)]
    pub challenge: Account<'info, Challenge>,
    #[account(
        init,
        payer = player,
        space = 8 + ChallengeProgress::INIT_SPACE,
        seeds = [b"challenge_progress", challenge.key().as_ref(), player.key().as_ref()],
        bump
    )]
    pub progress: Account<'info, ChallengeProgress>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn join_challenge(ctx: Context<JoinChallenge>) -> Result<()> {
    assert_not_paused(&ctx.accounts.config)?;
    let now = Clock::get()?.unix_timestamp;
    require!(ctx.accounts.challenge.active, GrowfiError::InvalidAccountState);
    require!(now >= ctx.accounts.challenge.starts_at && now < ctx.accounts.challenge.ends_at, GrowfiError::InvalidAccountState);
    let progress = &mut ctx.accounts.progress;
    progress.challenge = ctx.accounts.challenge.key();
    progress.player = ctx.accounts.player.key();
    progress.progress = 0;
    progress.joined_at = now;
    progress.claimed = false;
    progress.bump = ctx.bumps.progress;
    emit!(ChallengeJoinedEvent {
        challenge: ctx.accounts.challenge.key(),
        player: ctx.accounts.player.key(),
    });
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateProgress<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(seeds = [b"challenge", challenge.creator.as_ref(), challenge.challenge_id.to_le_bytes().as_ref()], bump = challenge.bump)]
    pub challenge: Account<'info, Challenge>,
    #[account(mut, seeds = [b"challenge_progress", challenge.key().as_ref(), player.key().as_ref()], bump = progress.bump)]
    pub progress: Account<'info, ChallengeProgress>,
    pub player: Signer<'info>,
}

pub fn update_progress(ctx: Context<UpdateProgress>, amount: u64) -> Result<()> {
    assert_not_paused(&ctx.accounts.config)?;
    require!(amount > 0, GrowfiError::InvalidAmount);
    ctx.accounts.progress.progress = ctx
        .accounts
        .progress
        .progress
        .checked_add(amount)
        .ok_or(GrowfiError::MathOverflow)?
        .min(ctx.accounts.challenge.target);
    Ok(())
}

#[derive(Accounts)]
pub struct ClaimChallengeReward<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(seeds = [b"challenge", challenge.creator.as_ref(), challenge.challenge_id.to_le_bytes().as_ref()], bump = challenge.bump)]
    pub challenge: Account<'info, Challenge>,
    #[account(mut, seeds = [b"challenge_progress", challenge.key().as_ref(), player.key().as_ref()], bump = progress.bump)]
    pub progress: Account<'info, ChallengeProgress>,
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(mut, constraint = grow_mint.key() == config.grow_mint @ GrowfiError::InvalidMint)]
    pub grow_mint: InterfaceAccount<'info, Mint>,
    #[account(mut, constraint = player_grow_ata.mint == grow_mint.key() @ GrowfiError::InvalidMint, constraint = player_grow_ata.owner == player.key() @ GrowfiError::Unauthorized)]
    pub player_grow_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, constraint = treasury_vault.key() == config.treasury_vault @ GrowfiError::InvalidAccountState, constraint = treasury_vault.owner == config.key() @ GrowfiError::Unauthorized)]
    pub treasury_vault: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn claim_challenge_reward(ctx: Context<ClaimChallengeReward>) -> Result<()> {
    assert_not_paused(&ctx.accounts.config)?;
    require!(!ctx.accounts.progress.claimed, GrowfiError::AlreadyClaimed);
    require!(ctx.accounts.progress.progress >= ctx.accounts.challenge.target, GrowfiError::InvalidAccountState);
    ctx.accounts.progress.claimed = true;
    if ctx.accounts.challenge.reward_grow > 0 {
        let signer: &[&[&[u8]]] = &[&[b"config", &[ctx.accounts.config.bump]]];
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.treasury_vault.to_account_info(),
                    mint: ctx.accounts.grow_mint.to_account_info(),
                    to: ctx.accounts.player_grow_ata.to_account_info(),
                    authority: ctx.accounts.config.to_account_info(),
                },
                signer,
            ),
            ctx.accounts.challenge.reward_grow,
            ctx.accounts.grow_mint.decimals,
        )?;
    }
    emit!(ChallengeRewardClaimedEvent {
        challenge: ctx.accounts.challenge.key(),
        player: ctx.accounts.player.key(),
        reward_grow: ctx.accounts.challenge.reward_grow,
    });
    Ok(())
}
