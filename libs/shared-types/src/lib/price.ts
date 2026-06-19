export interface PriceQuote {
  symbol: string;
  price: number;
  currency: string;
  change: number;
  changePct: number;
  asOf: string;
}

/** Payload pushed over the Socket.io `/prices` namespace. */
export interface PriceUpdate {
  symbol: string;
  price: number;
  currency: string;
  timestamp: number;
}

export const PRICE_NAMESPACE = '/prices';

export const PriceEvents = {
  Subscribe: 'price:subscribe',
  Unsubscribe: 'price:unsubscribe',
  Update: 'price:update',
} as const;
