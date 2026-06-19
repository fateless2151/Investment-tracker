export type TransactionType = 'BUY' | 'SELL' | 'DIVIDEND' | 'DEPOSIT' | 'WITHDRAWAL';

export interface Transaction {
  id: string;
  portfolioId: string;
  positionId: string | null;
  type: TransactionType;
  symbol: string;
  quantity: number;
  price: number;
  fees: number;
  currency: string;
  executedAt: string;
  createdAt: string;
}

export interface CreateTransactionDto {
  portfolioId: string;
  type: TransactionType;
  symbol: string;
  quantity: number;
  price: number;
  fees?: number;
  currency: string;
  executedAt: string;
}
