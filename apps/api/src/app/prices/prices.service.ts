import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import type { PriceQuote } from '@investment-tracker/shared-types';
import { RedisService } from '../redis/redis.service';

const CACHE_TTL_SECONDS = 60;

@Injectable()
export class PricesService {
  private readonly logger = new Logger(PricesService.name);

  constructor(private readonly redis: RedisService) {}

  /** Redis cache key — pattern: price:{symbol}:{currency} */
  private cacheKey(symbol: string, currency: string): string {
    return `price:${symbol.toUpperCase()}:${currency.toUpperCase()}`;
  }

  async getQuote(symbol: string, currency = 'USD'): Promise<PriceQuote> {
    const key = this.cacheKey(symbol, currency);

    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached) as PriceQuote;
    }

    const quote = await this.fetchFromProvider(symbol, currency);
    await this.redis.set(key, JSON.stringify(quote), CACHE_TTL_SECONDS);
    return quote;
  }

  /**
   * Fetch a live quote from the configured market-data provider.
   * TODO: branch on asset type — Finnhub for equities, CoinGecko for crypto.
   */
  private async fetchFromProvider(
    symbol: string,
    currency: string,
  ): Promise<PriceQuote> {
    const finnhubKey = process.env.FINNHUB_API_KEY;
    if (finnhubKey) {
      const { data } = await axios.get('https://finnhub.io/api/v1/quote', {
        params: { symbol: symbol.toUpperCase(), token: finnhubKey },
      });
      return {
        symbol: symbol.toUpperCase(),
        price: data.c,
        currency,
        change: data.d ?? 0,
        changePct: data.dp ?? 0,
        asOf: new Date().toISOString(),
      };
    }

    this.logger.warn('No market-data provider configured; returning stub');
    return {
      symbol: symbol.toUpperCase(),
      price: 0,
      currency,
      change: 0,
      changePct: 0,
      asOf: new Date().toISOString(),
    };
  }
}
