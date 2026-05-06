import { create } from "zustand";

type GameStore = {
  selectedPlotId: string | null;
  setSelectedPlotId: (plotId: string | null) => void;
  selectedSeedId: string | null;
  setSelectedSeedId: (seedId: string | null) => void;
};

export const useGameStore = create<GameStore>((set) => ({
  selectedPlotId: null,
  setSelectedPlotId: (selectedPlotId) => set({ selectedPlotId }),
  selectedSeedId: null,
  setSelectedSeedId: (selectedSeedId) => set({ selectedSeedId })
}));
