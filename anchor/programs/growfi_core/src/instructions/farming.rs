use anchor_lang::prelude::*;
use anchor_spl::token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::errors::GrowfiError;
use crate::events::{FruitSoldEvent, HarvestEvent, PlantWateredEvent, SeedPlantedEvent};
use crate::state::*;

#[derive(Accounts)]
pub struct PlantSeed<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"player", authority.key().as_ref()], bump = player.bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [b"seed_inventory", authority.key().as_ref()], bump = seed_inventory.bump)]
    pub seed_inventory: Account<'info, SeedInventory>,
    #[account(seeds = [b"seed_catalog", seed_catalog.seed_id.to_le_bytes().as_ref()], bump = seed_catalog.bump)]
    pub seed_catalog: Account<'info, SeedCatalog>,
    #[account(mut, seeds = [b"farm", authority.key().as_ref()], bump = farm.bump)]
    pub farm: Account<'info, Farm>,
    #[account(
        mut,
        seeds = [b"plot", farm.key().as_ref(), plot.x.to_le_bytes().as_ref(), plot.y.to_le_bytes().as_ref()],
        bump = plot.bump
    )]
    pub plot: Account<'info, Plot>,
    pub authority: Signer<'info>,
}

pub fn plant_seed(ctx: Context<PlantSeed>) -> Result<()> {
    assert_not_paused(&ctx.accounts.config)?;
    let now = Clock::get()?.unix_timestamp;
    require!(ctx.accounts.seed_catalog.active, GrowfiError::InvalidAccountState);
    require!(
        ctx.accounts.player.garden_level >= ctx.accounts.seed_catalog.required_garden_level,
        GrowfiError::GardenLevelTooLow
    );
    require!(ctx.accounts.plot.state == PlotState::Empty, GrowfiError::PlotNotEmpty);

    consume_stamina(&mut ctx.accounts.player, now, PLANT_STAMINA_COST)?;
    deduct_seed_balance(
        &mut ctx.accounts.seed_inventory,
        ctx.accounts.seed_catalog.seed_id,
        1,
    )?;

    let grow_complete_at = now
        .checked_add(ctx.accounts.seed_catalog.grow_time_seconds)
        .ok_or(GrowfiError::MathOverflow)?;
    let plot = &mut ctx.accounts.plot;
    plot.state = PlotState::Growing;
    plot.seed_id = ctx.accounts.seed_catalog.seed_id;
    plot.planted_at = now;
    plot.grow_complete_at = grow_complete_at;
    plot.next_harvest_at = grow_complete_at;
    plot.harvest_count = 0;
    plot.max_harvests = ctx.accounts.seed_catalog.max_harvests;
    plot.water_level = 0;
    plot.health = 100;
    plot.permanent_mutation = MutationKind::Normal;

    emit!(SeedPlantedEvent {
        owner: ctx.accounts.authority.key(),
        plot: plot.key(),
        seed_id: ctx.accounts.seed_catalog.seed_id,
        grow_complete_at,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct WaterPlant<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"player", authority.key().as_ref()], bump = player.bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [b"farm", authority.key().as_ref()], bump = farm.bump)]
    pub farm: Account<'info, Farm>,
    #[account(
        mut,
        seeds = [b"plot", farm.key().as_ref(), plot.x.to_le_bytes().as_ref(), plot.y.to_le_bytes().as_ref()],
        bump = plot.bump
    )]
    pub plot: Account<'info, Plot>,
    pub authority: Signer<'info>,
}

pub fn water_plant(ctx: Context<WaterPlant>) -> Result<()> {
    assert_not_paused(&ctx.accounts.config)?;
    let now = Clock::get()?.unix_timestamp;
    require!(
        matches!(ctx.accounts.plot.state, PlotState::Growing | PlotState::Regrowing | PlotState::Ready),
        GrowfiError::PlotEmpty
    );
    require!(ctx.accounts.player.water_charges > 0, GrowfiError::InsufficientWater);
    consume_stamina(&mut ctx.accounts.player, now, WATER_STAMINA_COST)?;
    ctx.accounts.player.water_charges = ctx
        .accounts
        .player
        .water_charges
        .checked_sub(1)
        .ok_or(GrowfiError::MathOverflow)?;

    let plot = &mut ctx.accounts.plot;
    plot.water_level = plot.water_level.saturating_add(1).min(WATER_MAX_LEVEL);
    plot.health = plot.health.saturating_add(WATER_HEALTH_GAIN).min(100);
    emit!(PlantWateredEvent {
        owner: ctx.accounts.authority.key(),
        plot: plot.key(),
        water_level: plot.water_level,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct HarvestPlant<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"player", authority.key().as_ref()], bump = player.bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [b"fruit_inventory", authority.key().as_ref()], bump = fruit_inventory.bump)]
    pub fruit_inventory: Account<'info, FruitInventory>,
    #[account(seeds = [b"seed_catalog", seed_catalog.seed_id.to_le_bytes().as_ref()], bump = seed_catalog.bump)]
    pub seed_catalog: Account<'info, SeedCatalog>,
    #[account(mut, seeds = [b"farm", authority.key().as_ref()], bump = farm.bump)]
    pub farm: Account<'info, Farm>,
    #[account(
        mut,
        seeds = [b"plot", farm.key().as_ref(), plot.x.to_le_bytes().as_ref(), plot.y.to_le_bytes().as_ref()],
        bump = plot.bump
    )]
    pub plot: Account<'info, Plot>,
    pub authority: Signer<'info>,
}

pub fn harvest_plant(ctx: Context<HarvestPlant>) -> Result<()> {
    assert_not_paused(&ctx.accounts.config)?;
    let clock = Clock::get()?;
    let now = clock.unix_timestamp;
    require!(ctx.accounts.plot.seed_id == ctx.accounts.seed_catalog.seed_id, GrowfiError::PlotEmpty);
    require!(
        matches!(ctx.accounts.plot.state, PlotState::Growing | PlotState::Ready | PlotState::Regrowing),
        GrowfiError::PlotEmpty
    );
    require!(now >= ctx.accounts.plot.grow_complete_at, GrowfiError::PlantNotReady);
    require!(now >= ctx.accounts.plot.next_harvest_at, GrowfiError::PlantNotReady);

    consume_stamina(&mut ctx.accounts.player, now, HARVEST_STAMINA_COST)?;
    let range = u64::from(
        ctx.accounts
            .seed_catalog
            .max_yield
            .checked_sub(ctx.accounts.seed_catalog.min_yield)
            .ok_or(GrowfiError::MathOverflow)?
            .checked_add(1)
            .ok_or(GrowfiError::MathOverflow)?,
    );
    let roll = random_u64(&clock, &ctx.accounts.authority.key(), &ctx.accounts.plot.key(), b"yield");
    let quantity = u64::from(ctx.accounts.seed_catalog.min_yield) + (roll % range);
    let mutation = roll_mutation(
        &clock,
        &ctx.accounts.authority.key(),
        &ctx.accounts.plot.key(),
        ctx.accounts.seed_catalog.mutation_chance_bps,
        ctx.accounts.plot.water_level,
    );

    add_fruit_balance(
        &mut ctx.accounts.fruit_inventory,
        ctx.accounts.seed_catalog.fruit_id,
        mutation,
        quantity,
    )?;

    let plot = &mut ctx.accounts.plot;
    plot.harvest_count = plot
        .harvest_count
        .checked_add(1)
        .ok_or(GrowfiError::MathOverflow)?;
    let plant_spent = plot.harvest_count >= plot.max_harvests;
    if plant_spent {
        plot.state = PlotState::Empty;
        plot.seed_id = 0;
        plot.planted_at = 0;
        plot.grow_complete_at = 0;
        plot.next_harvest_at = 0;
        plot.water_level = 0;
        plot.health = 0;
    } else {
        plot.state = PlotState::Regrowing;
        plot.next_harvest_at = now
            .checked_add(ctx.accounts.seed_catalog.regrow_time_seconds)
            .ok_or(GrowfiError::MathOverflow)?;
        plot.water_level = 0;
        plot.health = plot.health.saturating_add(HARVEST_HEALTH_GAIN).min(100);
    }
    ctx.accounts.player.total_harvests = ctx
        .accounts
        .player
        .total_harvests
        .checked_add(1)
        .ok_or(GrowfiError::MathOverflow)?;

    emit!(HarvestEvent {
        owner: ctx.accounts.authority.key(),
        plot: plot.key(),
        fruit_id: ctx.accounts.seed_catalog.fruit_id,
        mutation,
        quantity,
        harvest_count: plot.harvest_count,
        plant_spent,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct SellFruitToSystem<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"fruit_inventory", authority.key().as_ref()], bump = fruit_inventory.bump)]
    pub fruit_inventory: Account<'info, FruitInventory>,
    #[account(seeds = [b"seed_catalog", seed_catalog.seed_id.to_le_bytes().as_ref()], bump = seed_catalog.bump)]
    pub seed_catalog: Account<'info, SeedCatalog>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, constraint = grow_mint.key() == config.grow_mint @ GrowfiError::InvalidMint)]
    pub grow_mint: InterfaceAccount<'info, Mint>,
    #[account(mut, constraint = user_grow_ata.mint == grow_mint.key() @ GrowfiError::InvalidMint, constraint = user_grow_ata.owner == authority.key() @ GrowfiError::Unauthorized)]
    pub user_grow_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, constraint = treasury_vault.key() == config.treasury_vault @ GrowfiError::InvalidAccountState, constraint = treasury_vault.owner == config.key() @ GrowfiError::Unauthorized)]
    pub treasury_vault: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn sell_fruit_to_system(
    ctx: Context<SellFruitToSystem>,
    mutation: MutationKind,
    quantity: u64,
) -> Result<()> {
    assert_not_paused(&ctx.accounts.config)?;
    require!(quantity > 0, GrowfiError::InvalidAmount);
    let now = Clock::get()?.unix_timestamp;
    let day = now.checked_div(86_400).ok_or(GrowfiError::MathOverflow)?;
    if ctx.accounts.fruit_inventory.daily_sold_at != day {
        ctx.accounts.fruit_inventory.daily_sold_at = day;
        ctx.accounts.fruit_inventory.daily_sold_amount = 0;
    }

    let payout = ctx
        .accounts
        .seed_catalog
        .base_sell_price
        .checked_mul(mutation_multiplier_bps(mutation))
        .and_then(|value| value.checked_div(10_000))
        .and_then(|value| value.checked_mul(quantity))
        .ok_or(GrowfiError::MathOverflow)?;
    let next_daily = ctx
        .accounts
        .fruit_inventory
        .daily_sold_amount
        .checked_add(payout)
        .ok_or(GrowfiError::MathOverflow)?;
    require!(next_daily <= DAILY_SELL_CAP, GrowfiError::InvalidAmount);

    let balance = fruit_balance_mut(
        &mut ctx.accounts.fruit_inventory,
        ctx.accounts.seed_catalog.fruit_id,
        mutation,
    )?;
    require!(unlocked_fruit_amount(balance)? >= quantity, GrowfiError::InsufficientFruit);
    balance.amount = balance
        .amount
        .checked_sub(quantity)
        .ok_or(GrowfiError::MathOverflow)?;
    ctx.accounts.fruit_inventory.daily_sold_amount = next_daily;

    let signer: &[&[&[u8]]] = &[&[b"config", &[ctx.accounts.config.bump]]];
    let cpi_accounts = TransferChecked {
        from: ctx.accounts.treasury_vault.to_account_info(),
        mint: ctx.accounts.grow_mint.to_account_info(),
        to: ctx.accounts.user_grow_ata.to_account_info(),
        authority: ctx.accounts.config.to_account_info(),
    };
    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            cpi_accounts,
            signer,
        ),
        payout,
        ctx.accounts.grow_mint.decimals,
    )?;

    emit!(FruitSoldEvent {
        owner: ctx.accounts.authority.key(),
        fruit_id: ctx.accounts.seed_catalog.fruit_id,
        mutation,
        quantity,
        payout,
    });
    Ok(())
}

fn random_u64(clock: &Clock, authority: &Pubkey, plot: &Pubkey, salt: &[u8]) -> u64 {
    let mut value = clock.slot ^ ((clock.unix_timestamp as u64).rotate_left(17));
    value = mix_random_bytes(value, authority.as_ref());
    value = mix_random_bytes(value, plot.as_ref());
    mix_random_bytes(value, salt)
}

fn mix_random_bytes(mut value: u64, bytes: &[u8]) -> u64 {
    for byte in bytes {
        value ^= u64::from(*byte)
            .wrapping_add(0x9e37_79b9_7f4a_7c15)
            .wrapping_add(value << 6)
            .wrapping_add(value >> 2);
    }
    value
}

fn roll_mutation(
    clock: &Clock,
    authority: &Pubkey,
    plot: &Pubkey,
    base_chance_bps: u16,
    water_level: u8,
) -> MutationKind {
    let chance = u64::from(base_chance_bps)
        .saturating_add(u64::from(water_level) * 25)
        .min(9_500);
    let roll = random_u64(clock, authority, plot, b"mutation") % 10_000;
    if roll >= chance {
        return MutationKind::Normal;
    }
    match random_u64(clock, authority, plot, b"mutation-kind") % 100 {
        0..=59 => MutationKind::Big,
        60..=84 => MutationKind::Sweet,
        85..=94 => MutationKind::Golden,
        95..=98 => MutationKind::Crystal,
        _ => MutationKind::Rainbow,
    }
}
