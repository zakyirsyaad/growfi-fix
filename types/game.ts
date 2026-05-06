import type {
  ActivityType,
  ListingStatus,
  Mutation,
  PlantState,
  PlotState,
  Rarity,
  TradeStatus,
} from "@prisma/client";

export type ClientRarity = Rarity;
export type ClientMutation = Mutation;
export type ClientPlotState = PlotState;
export type ClientPlantState = PlantState;
export type ClientListingStatus = ListingStatus;
export type ClientTradeStatus = TradeStatus;
export type ClientActivityType = ActivityType;

export type ApiErrorPayload = {
  error: string;
  details?: unknown;
};
