import { create } from 'zustand';

export type DashboardView = 'campaign-velocity' | 'savar-logistics' | 'ecosystem-health';

interface DashboardState {
  activeView: DashboardView;
  setActiveView: (view: DashboardView) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  activeView: 'campaign-velocity',
  setActiveView: (view) => set({ activeView: view }),
}));
