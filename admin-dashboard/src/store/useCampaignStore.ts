import { create } from 'zustand';

export interface LiveTier {
  id: string;
  targetVolume: number;
  unlockedPrice: number;
  isUnlocked: boolean;
}

interface CampaignLiveState {
  pledgeCount: number;
  currentPrice: number;
  status: 'PENDING' | 'ACTIVE' | 'SUCCESS' | 'FAILED';
  tiers: LiveTier[];
  setLiveState: (state: Partial<CampaignLiveState>) => void;
}

export const useCampaignStore = create<CampaignLiveState>((set) => ({
  pledgeCount: 0,
  currentPrice: 0,
  status: 'ACTIVE',
  tiers: [],
  setLiveState: (state) => set((prev) => ({ ...prev, ...state })),
}));
