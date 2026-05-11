use anchor_lang::prelude::*;

#[error_code]
pub enum GrowfiError {
    #[msg("The game is paused.")]
    GamePaused,
    #[msg("The signer is not authorized for this action.")]
    Unauthorized,
    #[msg("The supplied token mint is not the configured $GROW mint.")]
    InvalidMint,
    #[msg("Insufficient $GROW balance.")]
    InsufficientBalance,
    #[msg("Insufficient seed balance.")]
    InsufficientSeed,
    #[msg("Insufficient fruit balance.")]
    InsufficientFruit,
    #[msg("Fruit quantity is locked.")]
    FruitLocked,
    #[msg("The plot is not empty.")]
    PlotNotEmpty,
    #[msg("The plot has no active plant.")]
    PlotEmpty,
    #[msg("The plant is not ready.")]
    PlantNotReady,
    #[msg("Garden level is too low.")]
    GardenLevelTooLow,
    #[msg("Insufficient stamina.")]
    InsufficientStamina,
    #[msg("Insufficient water charges.")]
    InsufficientWater,
    #[msg("The shop rotation is expired or not active.")]
    ShopExpired,
    #[msg("The shop item is out of stock.")]
    ShopOutOfStock,
    #[msg("The per-user buy limit has been reached.")]
    MaxBuyReached,
    #[msg("The listing is not active.")]
    ListingInactive,
    #[msg("The listing has expired.")]
    ListingExpired,
    #[msg("The trade has expired.")]
    TradeExpired,
    #[msg("The trade is not confirmed by both users.")]
    TradeNotConfirmed,
    #[msg("Invalid trade state.")]
    InvalidTradeState,
    #[msg("This reward or action has already been claimed.")]
    AlreadyClaimed,
    #[msg("Invalid amount.")]
    InvalidAmount,
    #[msg("Math overflow.")]
    MathOverflow,
    #[msg("Inventory vector is full.")]
    InventoryFull,
    #[msg("Invalid account state.")]
    InvalidAccountState,
}
