import { create } from 'zustand';
import type { Portfolio } from '@investment-tracker/shared-types';
import { api } from '../lib/api';

interface PortfolioState {
  portfolios: Portfolio[];
  loading: boolean;
  error: string | null;
  fetchPortfolios: () => Promise<void>;
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  portfolios: [],
  loading: false,
  error: null,
  fetchPortfolios: async () => {
    set({ loading: true, error: null });
    try {
      const portfolios = await api.get<Portfolio[]>('/portfolios');
      set({ portfolios, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },
}));
