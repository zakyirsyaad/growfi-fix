export const ASSET_KEYS = {
  tiles: {
    grass: "tile-grass",
    path: "tile-path",
    water: "tile-water",
    fence: "tile-fence",
    soilEmpty: "plot-empty",
    soilLocked: "plot-locked",
    sprout: "plot-sprout",
    plantSmall: "plot-plant-small",
    plantMedium: "plot-plant-medium",
    plantReady: "plot-ready",
    regrowing: "plot-regrowing"
  },
  characters: {
    player: "player-farmer",
    npc: "town-npc"
  },
  objects: {
    house: "farm-house",
    mailbox: "mailbox",
    farmBoard: "farm-board",
    storageChest: "storage-chest",
    waterWell: "water-well",
    scarecrow: "scarecrow",
    petArea: "pet-area",
    questBoard: "quest-board",
    bush: "farm-bush",
    tree: "farm-tree",
    flower: "farm-flower",
    rock: "farm-rock",
    shop: "seed-shop",
    marketBoard: "market-board",
    tradeBoard: "trade-board",
    bank: "wallet-bank",
    portal: "farm-portal",
    leaderboard: "leaderboard-board"
  }
} as const;
