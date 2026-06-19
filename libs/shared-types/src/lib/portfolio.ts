import type { Position } from './position';

export interface Portfolio {
  id: string;
  userId: string;
  name: string;
  baseCurrency: string;
  createdAt: string;
  updatedAt: string;
  positions?: Position[];
}

export interface CreatePortfolioDto {
  name: string;
  baseCurrency: string;
}

export interface PortfolioValuation {
  portfolioId: string;
  marketValue: number;
  costBasis: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  currency: string;
  asOf: string;
}

/** A single day in a portfolio's reconstructed history. */
export interface PortfolioHistoryPoint {
  date: string; // YYYY-MM-DD
  costBasis: number; // cost of open positions at end of day
  realizedPnl: number; // cumulative realized P&L through that day
}

export interface PortfolioHistory {
  portfolioId: string;
  currency: string;
  points: PortfolioHistoryPoint[];
}
