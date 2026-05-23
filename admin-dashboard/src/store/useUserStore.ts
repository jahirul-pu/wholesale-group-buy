import { create } from 'zustand';

export interface SimulatedUser {
  id: string;
  phoneNumber: string;
  currentTrust: number;
}

interface UserState {
  currentUser: SimulatedUser | null;
  setCurrentUser: (user: SimulatedUser | null) => void;
}

export const useUserStore = create<UserState>((set) => ({
  currentUser: null,
  setCurrentUser: (user) => {
    if (user && typeof window !== 'undefined') {
      localStorage.setItem('simulated_user_id', user.id);
    }
    set({ currentUser: user });
  },
}));
