use anchor_lang::prelude::*;

use crate::events::PlayerCreatedEvent;
use crate::state::*;

#[derive(Accounts)]
pub struct CreatePlayer<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        init,
        payer = authority,
        space = 8 + Player::INIT_SPACE,
        seeds = [b"player", authority.key().as_ref()],
        bump
    )]
    pub player: Account<'info, Player>,
    #[account(
        init,
        payer = authority,
        space = 8 + SeedInventory::INIT_SPACE,
        seeds = [b"seed_inventory", authority.key().as_ref()],
        bump
    )]
    pub seed_inventory: Account<'info, SeedInventory>,
    #[account(
        init,
        payer = authority,
        space = 8 + FruitInventory::INIT_SPACE,
        seeds = [b"fruit_inventory", authority.key().as_ref()],
        bump
    )]
    pub fruit_inventory: Account<'info, FruitInventory>,
    #[account(
        init,
        payer = authority,
        space = 8 + DecorationInventory::INIT_SPACE,
        seeds = [b"decoration_inventory", authority.key().as_ref()],
        bump
    )]
    pub decoration_inventory: Account<'info, DecorationInventory>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn create_player(
    ctx: Context<CreatePlayer>,
    discord_hash: [u8; 32],
    username_hash: [u8; 32],
) -> Result<()> {
    assert_not_paused(&ctx.accounts.config)?;
    let now = Clock::get()?.unix_timestamp;
    let authority = ctx.accounts.authority.key();

    let player = &mut ctx.accounts.player;
    player.authority = authority;
    player.discord_hash = discord_hash;
    player.username_hash = username_hash;
    player.farm = Pubkey::default();
    player.garden_level = 1;
    player.stamina = 100;
    player.max_stamina = 100;
    player.water_charges = 20;
    player.max_water_charges = 20;
    player.last_stamina_update = now;
    player.total_harvests = 0;
    player.total_trades = 0;
    player.created_at = now;
    player.bump = ctx.bumps.player;

    ctx.accounts.seed_inventory.owner = authority;
    ctx.accounts.seed_inventory.balances = Vec::new();
    ctx.accounts.seed_inventory.bump = ctx.bumps.seed_inventory;

    ctx.accounts.fruit_inventory.owner = authority;
    ctx.accounts.fruit_inventory.balances = Vec::new();
    ctx.accounts.fruit_inventory.daily_sold_at = now;
    ctx.accounts.fruit_inventory.daily_sold_amount = 0;
    ctx.accounts.fruit_inventory.bump = ctx.bumps.fruit_inventory;

    ctx.accounts.decoration_inventory.owner = authority;
    ctx.accounts.decoration_inventory.balances = Vec::new();
    ctx.accounts.decoration_inventory.bump = ctx.bumps.decoration_inventory;

    emit!(PlayerCreatedEvent {
        authority,
        player: player.key(),
    });
    Ok(())
}
