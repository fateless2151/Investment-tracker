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
