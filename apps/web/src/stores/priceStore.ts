import { create } from 'zustand';
import type { PriceUpdate } from '@investment-tracker/shared-types';
import { subscribeToSymbol } from '../lib/socket';

interface PriceState {
  /** Latest price keyed by symbol. */
  prices: Record<string, PriceUpdate>;
  unsubscribers: Record<string, () => void>;
  subscribe: (symbol: string) => void;
  unsubscribe: (symbol: string) => void;
}

export const usePriceStore = create<PriceState>((set, get) => ({
  prices: {},
  unsubscribers: {},
  subscribe: (symbol) => {
    if (get().unsubscribers[symbol]) return;
    const unsub = subscribeToSymbol(symbol, (update) =>
      set((state) => ({
        prices: { ...state.prices, [update.symbol]: update },
      })),
    );
    set((state) => ({
      unsubscribers: { ...state.unsubscribers, [symbol]: unsub },
    }));
  },
  unsubscribe: (symbol) => {
    get().unsubscribers[symbol]?.();
    set((state) => {
      const { [symbol]: _, ...rest } = state.unsubscribers;
      return { unsubscribers: rest };
    });
  },
}));
