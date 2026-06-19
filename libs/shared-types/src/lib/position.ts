export type AssetType = 'STOCK' | 'CRYPTO' | 'ETF' | 'CASH';

export interface Position {
  id: string;
  portfolioId: string;
  symbol: string;
  assetType: AssetType;
  quantity: number;
  avgCostBasis: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePositionDto {
  symbol: string;
  assetType: AssetType;
  quantity: number;
  avgCostBasis: number;
  currency: string;
}
