import { create } from 'zustand';
import type {
  CreatePortfolioDto,
  Portfolio,
} from '@investment-tracker/shared-types';
import { api } from '../lib/api';

interface PortfolioState {
  portfolios: Portfolio[];
  loading: boolean;
  error: string | null;
  fetchPortfolios: () => Promise<void>;
  createPortfolio: (input: CreatePortfolioDto) => Promise<Portfolio>;
  deletePortfolio: (id: string) => Promise<void>;
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
  createPortfolio: async (input) => {
    const created = await api.post<Portfolio>('/portfolios', input);
    set((state) => ({ portfolios: [...state.portfolios, created] }));
    return created;
  },
  deletePortfolio: async (id) => {
    await api.delete(`/portfolios/${id}`);
    set((state) => ({
      portfolios: state.portfolios.filter((p) => p.id !== id),
    }));
  },
}));
