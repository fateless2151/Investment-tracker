import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import type { AssetType, PriceQuote } from '@investment-tracker/shared-types';
import { RedisService } from '../redis/redis.service';

const CACHE_TTL_SECONDS = 60;

/**
 * Maps common ticker symbols to CoinGecko coin IDs. CoinGecko's API is keyed by
 * IDs (e.g. "bitcoin"), not tickers ("BTC"), so we need this lookup. Extend it
 * at runtime with COINGECKO_ID_MAP (a JSON object of TICKER -> id).
 */
const BUILTIN_COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  USDT: 'tether',
  USDC: 'usd-coin',
  BNB: 'binancecoin',
  SOL: 'solana',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  DOT: 'polkadot',
  MATIC: 'matic-network',
  LTC: 'litecoin',
  TRX: 'tron',
  AVAX: 'avalanche-2',
  LINK: 'chainlink',
};

@Injectable()
export class PricesService {
  private readonly logger = new Logger(PricesService.name);
  private readonly coinGeckoIds: Record<string, string>;

  constructor(private readonly redis: RedisService) {
    this.coinGeckoIds = { ...BUILTIN_COINGECKO_IDS, ...this.loadIdOverrides() };
  }

  /** Redis cache key — pattern: price:{symbol}:{currency} */
  private cacheKey(symbol: string, currency: string): string {
    return `price:${symbol.toUpperCase()}:${currency.toUpperCase()}`;
  }

  async getQuote(
    symbol: string,
    currency = 'USD',
    assetType?: AssetType,
  ): Promise<PriceQuote> {
    const key = this.cacheKey(symbol, currency);

    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached) as PriceQuote;
    }

    let quote: PriceQuote;
    try {
      quote = await this.fetchFromProvider(symbol, currency, assetType);
    } catch (err) {
      // A provider outage/rate-limit must never 500 the caller (valuation,
      // history, the /prices endpoint). Degrade to a zero-price stub; don't
      // cache it, so the next call retries.
      this.logger.warn(
        `Quote fetch for ${symbol} failed: ${(err as Error).message}; returning stub`,
      );
      return {
        symbol: symbol.toUpperCase(),
        price: 0,
        currency,
        change: 0,
        changePct: 0,
        asOf: new Date().toISOString(),
      };
    }

    await this.redis.set(key, JSON.stringify(quote), CACHE_TTL_SECONDS);
    return quote;
  }

  /**
   * Route to the right provider: crypto → CoinGecko, everything else → Finnhub.
   * When the asset type isn't supplied (e.g. the live feed only knows a symbol),
   * a symbol that resolves to a known CoinGecko ID is treated as crypto.
   */
  private async fetchFromProvider(
    symbol: string,
    currency: string,
    assetType?: AssetType,
  ): Promise<PriceQuote> {
    const upper = symbol.toUpperCase();
    const coinId = this.coinGeckoIds[upper];
    const isCrypto =
      assetType === 'CRYPTO' || (assetType === undefined && coinId !== undefined);

    if (isCrypto) {
      return this.fetchFromCoinGecko(upper, coinId, currency);
    }
    return this.fetchFromFinnhub(upper, currency);
  }

  private async fetchFromFinnhub(
    symbol: string,
    currency: string,
  ): Promise<PriceQuote> {
    const finnhubKey = process.env.FINNHUB_API_KEY;
    if (!finnhubKey) {
      return this.stubQuote(symbol, currency, 'Finnhub');
    }

    const { data } = await axios.get('https://finnhub.io/api/v1/quote', {
      params: { symbol, token: finnhubKey },
    });
    return {
      symbol,
      price: data.c ?? 0,
      currency,
      change: data.d ?? 0,
      changePct: data.dp ?? 0,
      asOf: new Date().toISOString(),
    };
  }

  private async fetchFromCoinGecko(
    symbol: string,
    coinId: string | undefined,
    currency: string,
  ): Promise<PriceQuote> {
    if (!coinId) {
      this.logger.warn(
        `No CoinGecko ID for ${symbol}; set COINGECKO_ID_MAP to add it`,
      );
      return this.stubQuote(symbol, currency, 'CoinGecko');
    }

    const vs = currency.toLowerCase();
    const apiKey = process.env.COINGECKO_API_KEY;
    const { data } = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price',
      {
        params: { ids: coinId, vs_currencies: vs, include_24hr_change: true },
        headers: apiKey ? { 'x-cg-demo-api-key': apiKey } : undefined,
      },
    );

    const entry = data?.[coinId];
    const price = entry?.[vs];
    if (price == null) {
      this.logger.warn(
        `CoinGecko returned no ${vs} price for ${symbol} (${coinId})`,
      );
      return this.stubQuote(symbol, currency, 'CoinGecko');
    }

    const changePct = entry[`${vs}_24h_change`] ?? 0;
    // CoinGecko gives the 24h percent change; derive the absolute change.
    const denom = 1 + changePct / 100;
    const change = denom !== 0 ? price - price / denom : 0;

    return {
      symbol,
      price,
      currency,
      change,
      changePct,
      asOf: new Date().toISOString(),
    };
  }

  private stubQuote(
    symbol: string,
    currency: string,
    provider: string,
  ): PriceQuote {
    this.logger.warn(`${provider} not configured for ${symbol}; returning stub`);
    return {
      symbol,
      price: 0,
      currency,
      change: 0,
      changePct: 0,
      asOf: new Date().toISOString(),
    };
  }

  private loadIdOverrides(): Record<string, string> {
    const raw = process.env.COINGECKO_ID_MAP;
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      return Object.fromEntries(
        Object.entries(parsed).map(([k, v]) => [k.toUpperCase(), v]),
      );
    } catch {
      this.logger.warn('COINGECKO_ID_MAP is not valid JSON; ignoring');
      return {};
    }
  }
}
