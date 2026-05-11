use anchor_lang::prelude::*;
use anchor_spl::token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::errors::GrowfiError;
use crate::events::{DecorationBoughtEvent, DecorationPlacedEvent};
use crate::state::*;

#[derive(Accounts)]
pub struct BuyDecoration<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"decoration_inventory", buyer.key().as_ref()], bump = decoration_inventory.bump)]
    pub decoration_inventory: Account<'info, DecorationInventory>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut, constraint = grow_mint.key() == config.grow_mint @ GrowfiError::InvalidMint)]
    pub grow_mint: InterfaceAccount<'info, Mint>,
    #[account(mut, constraint = buyer_grow_ata.mint == grow_mint.key() @ GrowfiError::InvalidMint, constraint = buyer_grow_ata.owner == buyer.key() @ GrowfiError::Unauthorized)]
    pub buyer_grow_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, constraint = treasury_vault.key() == config.treasury_vault @ GrowfiError::InvalidAccountState)]
    pub treasury_vault: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn buy_decoration(ctx: Context<BuyDecoration>, decoration_id: u64, price: u64) -> Result<()> {
    assert_not_paused(&ctx.accounts.config)?;
    require!(decoration_id > 0 && price > 0, GrowfiError::InvalidAmount);
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
        price,
        ctx.accounts.grow_mint.decimals,
    )?;
    add_decoration_balance(&mut ctx.accounts.decoration_inventory, decoration_id, 1)?;
    emit!(DecorationBoughtEvent {
        buyer: ctx.accounts.buyer.key(),
        decoration_id,
        price,
    });
    Ok(())
}

#[derive(Accounts)]
#[instruction(placement_id: u64)]
pub struct PlaceDecoration<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(seeds = [b"decoration_inventory", owner.key().as_ref()], bump = decoration_inventory.bump)]
    pub decoration_inventory: Account<'info, DecorationInventory>,
    #[account(mut, seeds = [b"farm", owner.key().as_ref()], bump = farm.bump)]
    pub farm: Account<'info, Farm>,
    #[account(
        init,
        payer = owner,
        space = 8 + DecorationPlacement::INIT_SPACE,
        seeds = [b"decoration", farm.key().as_ref(), placement_id.to_le_bytes().as_ref()],
        bump
    )]
    pub placement: Account<'info, DecorationPlacement>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn place_decoration(
    ctx: Context<PlaceDecoration>,
    placement_id: u64,
    decoration_id: u64,
    x: u16,
    y: u16,
    rotation: u16,
) -> Result<()> {
    assert_not_paused(&ctx.accounts.config)?;
    require_decoration(&ctx.accounts.decoration_inventory, decoration_id)?;
    let placement = &mut ctx.accounts.placement;
    placement.farm = ctx.accounts.farm.key();
    placement.owner = ctx.accounts.owner.key();
    placement.placement_id = placement_id;
    placement.decoration_id = decoration_id;
    placement.x = x;
    placement.y = y;
    placement.rotation = rotation;
    placement.active = true;
    placement.bump = ctx.bumps.placement;
    emit!(DecorationPlacedEvent {
        owner: ctx.accounts.owner.key(),
        farm: ctx.accounts.farm.key(),
        placement_id,
        decoration_id,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct RemoveDecoration<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"decoration", farm.key().as_ref(), placement.placement_id.to_le_bytes().as_ref()], bump = placement.bump)]
    pub placement: Account<'info, DecorationPlacement>,
    #[account(seeds = [b"farm", owner.key().as_ref()], bump = farm.bump)]
    pub farm: Account<'info, Farm>,
    pub owner: Signer<'info>,
}

pub fn remove_decoration(ctx: Context<RemoveDecoration>) -> Result<()> {
    assert_not_paused(&ctx.accounts.config)?;
    require_keys_eq!(ctx.accounts.placement.owner, ctx.accounts.owner.key(), GrowfiError::Unauthorized);
    ctx.accounts.placement.active = false;
    Ok(())
}
