use anchor_lang::prelude::*;
use anchor_spl::token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::errors::GrowfiError;
use crate::events::{FarmCreatedEvent, FarmUpgradedEvent};
use crate::state::*;

#[derive(Accounts)]
pub struct CreateFarm<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"player", owner.key().as_ref()], bump = player.bump, has_one = authority @ GrowfiError::Unauthorized)]
    pub player: Account<'info, Player>,
    #[account(
        init,
        payer = authority,
        space = 8 + Farm::INIT_SPACE,
        seeds = [b"farm", owner.key().as_ref()],
        bump
    )]
    pub farm: Account<'info, Farm>,
    /// CHECK: PDA seed source for farm owner. It may be the same as authority.
    pub owner: UncheckedAccount<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn create_farm(ctx: Context<CreateFarm>) -> Result<()> {
    assert_not_paused(&ctx.accounts.config)?;
    require_keys_eq!(
        ctx.accounts.owner.key(),
        ctx.accounts.authority.key(),
        GrowfiError::Unauthorized
    );
    let (width, height, _) = farm_dimensions_for_level(1)?;
    let now = Clock::get()?.unix_timestamp;
    let farm = &mut ctx.accounts.farm;
    farm.owner = ctx.accounts.owner.key();
    farm.level = 1;
    farm.width = width;
    farm.height = height;
    farm.plot_count = u16::from(width) * u16::from(height);
    farm.total_visits = 0;
    farm.total_likes = 0;
    farm.is_public = false;
    farm.created_at = now;
    farm.bump = ctx.bumps.farm;

    ctx.accounts.player.farm = farm.key();
    emit!(FarmCreatedEvent {
        owner: farm.owner,
        farm: farm.key(),
        width,
        height,
    });
    Ok(())
}

#[derive(Accounts)]
#[instruction(x: u16, y: u16)]
pub struct CreateInitialPlots<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"farm", owner.key().as_ref()], bump = farm.bump, has_one = owner)]
    pub farm: Account<'info, Farm>,
    #[account(
        init,
        payer = authority,
        space = 8 + Plot::INIT_SPACE,
        seeds = [b"plot", farm.key().as_ref(), x.to_le_bytes().as_ref(), y.to_le_bytes().as_ref()],
        bump
    )]
    pub plot: Account<'info, Plot>,
    /// CHECK: PDA seed source for farm owner.
    pub owner: UncheckedAccount<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn create_initial_plots(ctx: Context<CreateInitialPlots>, x: u16, y: u16) -> Result<()> {
    assert_not_paused(&ctx.accounts.config)?;
    require_keys_eq!(
        ctx.accounts.owner.key(),
        ctx.accounts.authority.key(),
        GrowfiError::Unauthorized
    );
    require!(
        x < u16::from(ctx.accounts.farm.width) && y < u16::from(ctx.accounts.farm.height),
        GrowfiError::InvalidAmount
    );
    let plot = &mut ctx.accounts.plot;
    plot.farm = ctx.accounts.farm.key();
    plot.owner = ctx.accounts.owner.key();
    plot.x = x;
    plot.y = y;
    plot.state = PlotState::Empty;
    plot.seed_id = 0;
    plot.planted_at = 0;
    plot.grow_complete_at = 0;
    plot.next_harvest_at = 0;
    plot.harvest_count = 0;
    plot.max_harvests = 0;
    plot.water_level = 0;
    plot.health = 100;
    plot.permanent_mutation = MutationKind::Normal;
    plot.bump = ctx.bumps.plot;
    Ok(())
}

#[derive(Accounts)]
pub struct UpgradeFarm<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"player", authority.key().as_ref()], bump = player.bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [b"farm", authority.key().as_ref()], bump = farm.bump)]
    pub farm: Account<'info, Farm>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, constraint = grow_mint.key() == config.grow_mint @ GrowfiError::InvalidMint)]
    pub grow_mint: InterfaceAccount<'info, Mint>,
    #[account(mut, constraint = user_grow_ata.mint == grow_mint.key() @ GrowfiError::InvalidMint, constraint = user_grow_ata.owner == authority.key() @ GrowfiError::Unauthorized)]
    pub user_grow_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, constraint = treasury_vault.key() == config.treasury_vault @ GrowfiError::InvalidAccountState)]
    pub treasury_vault: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn upgrade_farm(ctx: Context<UpgradeFarm>) -> Result<()> {
    assert_not_paused(&ctx.accounts.config)?;
    let next_level = ctx
        .accounts
        .farm
        .level
        .checked_add(1)
        .ok_or(GrowfiError::MathOverflow)?;
    let (width, height, cost) = farm_dimensions_for_level(next_level)?;
    if cost > 0 {
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.user_grow_ata.to_account_info(),
            mint: ctx.accounts.grow_mint.to_account_info(),
            to: ctx.accounts.treasury_vault.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        transfer_checked(
            CpiContext::new(ctx.accounts.token_program.key(), cpi_accounts),
            cost,
            ctx.accounts.grow_mint.decimals,
        )?;
    }

    let farm = &mut ctx.accounts.farm;
    farm.level = next_level;
    farm.width = width;
    farm.height = height;
    farm.plot_count = u16::from(width) * u16::from(height);
    ctx.accounts.player.garden_level = next_level;
    emit!(FarmUpgradedEvent {
        owner: ctx.accounts.authority.key(),
        level: next_level,
        width,
        height,
        cost,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct RefillWater<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"player", authority.key().as_ref()], bump = player.bump)]
    pub player: Account<'info, Player>,
    pub authority: Signer<'info>,
}

pub fn refill_water(ctx: Context<RefillWater>) -> Result<()> {
    assert_not_paused(&ctx.accounts.config)?;
    ctx.accounts.player.water_charges = ctx.accounts.player.max_water_charges;
    Ok(())
}
