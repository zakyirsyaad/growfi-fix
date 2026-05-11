use anchor_lang::prelude::*;

use crate::state::{ListingStatus, MutationKind, TradeStatus};

#[event]
pub struct ConfigUpdatedEvent {
    pub admin: Pubkey,
    pub grow_mint: Pubkey,
    pub paused: bool,
}

#[event]
pub struct PlayerCreatedEvent {
    pub authority: Pubkey,
    pub player: Pubkey,
}

#[event]
pub struct FarmCreatedEvent {
    pub owner: Pubkey,
    pub farm: Pubkey,
    pub width: u8,
    pub height: u8,
}

#[event]
pub struct FarmUpgradedEvent {
    pub owner: Pubkey,
    pub level: u8,
    pub width: u8,
    pub height: u8,
    pub cost: u64,
}

#[event]
pub struct SeedBoughtEvent {
    pub buyer: Pubkey,
    pub seed_id: u64,
    pub quantity: u64,
    pub total_price: u64,
}

#[event]
pub struct SeedPlantedEvent {
    pub owner: Pubkey,
    pub plot: Pubkey,
    pub seed_id: u64,
    pub grow_complete_at: i64,
}

#[event]
pub struct PlantWateredEvent {
    pub owner: Pubkey,
    pub plot: Pubkey,
    pub water_level: u8,
}

#[event]
pub struct HarvestEvent {
    pub owner: Pubkey,
    pub plot: Pubkey,
    pub fruit_id: u64,
    pub mutation: MutationKind,
    pub quantity: u64,
    pub harvest_count: u16,
    pub plant_spent: bool,
}

#[event]
pub struct FruitSoldEvent {
    pub owner: Pubkey,
    pub fruit_id: u64,
    pub mutation: MutationKind,
    pub quantity: u64,
    pub payout: u64,
}

#[event]
pub struct ListingCreatedEvent {
    pub listing: Pubkey,
    pub seller: Pubkey,
    pub fruit_id: u64,
    pub mutation: MutationKind,
    pub quantity: u64,
    pub price: u64,
}

#[event]
pub struct ListingCancelledEvent {
    pub listing: Pubkey,
    pub seller: Pubkey,
}

#[event]
pub struct ListingBoughtEvent {
    pub listing: Pubkey,
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub price: u64,
    pub fee: u64,
}

#[event]
pub struct TradeCreatedEvent {
    pub trade: Pubkey,
    pub initiator: Pubkey,
    pub recipient: Pubkey,
    pub expires_at: i64,
}

#[event]
pub struct TradeCompletedEvent {
    pub trade: Pubkey,
    pub initiator: Pubkey,
    pub recipient: Pubkey,
    pub status: TradeStatus,
}

#[event]
pub struct CreatorEnabledEvent {
    pub owner: Pubkey,
    pub creator: Pubkey,
}

#[event]
pub struct CreatorTippedEvent {
    pub tipper: Pubkey,
    pub creator: Pubkey,
    pub amount: u64,
    pub fee: u64,
}

#[event]
pub struct DecorationBoughtEvent {
    pub buyer: Pubkey,
    pub decoration_id: u64,
    pub price: u64,
}

#[event]
pub struct DecorationPlacedEvent {
    pub owner: Pubkey,
    pub farm: Pubkey,
    pub placement_id: u64,
    pub decoration_id: u64,
}

#[event]
pub struct ChallengeJoinedEvent {
    pub challenge: Pubkey,
    pub player: Pubkey,
}

#[event]
pub struct ChallengeRewardClaimedEvent {
    pub challenge: Pubkey,
    pub player: Pubkey,
    pub reward_grow: u64,
}

#[event]
pub struct ListingStatusChangedEvent {
    pub listing: Pubkey,
    pub status: ListingStatus,
}
