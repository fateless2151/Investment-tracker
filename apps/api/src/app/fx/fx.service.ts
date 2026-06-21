import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { RedisService } from '../redis/redis.service';

// FX moves slowly (Frankfurter serves daily ECB reference rates), so cache for
// an hour rather than the ~60s used for live security prices.
const CACHE_TTL_SECONDS = 3600;

/**
 * Foreign-exchange rates, used to convert positions/transactions held in one
 * currency into a portfolio's base currency. Rates come from Frankfurter
 * (https://frankfurter.app — keyless ECB data) and are cached in Redis under
 * `fx:{from}:{to}`. An override map can be supplied via FX_RATES for offline
 * use. Unknown pairs fall back to 1 so valuation degrades gracefully.
 */
@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);
  private readonly overrides: Record<string, number>;

  constructor(private readonly redis: RedisService) {
    this.overrides = this.loadOverrides();
  }

  /** Returns the rate to multiply a `from` amount by to get `to`. */
  async getRate(from: string, to: string): Promise<number> {
    const f = from.toUpperCase();
    const t = to.toUpperCase();
    if (f === t) return 1;

    const override = this.overrides[`${f}:${t}`];
    if (override != null) return override;

    const key = `fx:${f}:${t}`;
    const cached = await this.redis.get(key);
    if (cached != null) {
      const n = Number(cached);
      if (Number.isFinite(n)) return n;
    }

    const rate = await this.fetchRate(f, t);
    await this.redis.set(key, String(rate), CACHE_TTL_SECONDS);
    return rate;
  }

  private async fetchRate(from: string, to: string): Promise<number> {
    try {
      const { data } = await axios.get('https://api.frankfurter.app/latest', {
        params: { from, to },
      });
      const rate = data?.rates?.[to];
      if (typeof rate === 'number' && Number.isFinite(rate)) {
        return rate;
      }
      this.logger.warn(`Frankfurter returned no ${from}->${to} rate`);
    } catch (err) {
      this.logger.warn(
        `FX lookup ${from}->${to} failed: ${(err as Error).message}`,
      );
    }
    // Degrade gracefully rather than failing the whole valuation.
    return 1;
  }

  private loadOverrides(): Record<string, number> {
    const raw = process.env.FX_RATES;
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as Record<string, number>;
      return Object.fromEntries(
        Object.entries(parsed).map(([k, v]) => [k.toUpperCase(), v]),
      );
    } catch {
      this.logger.warn('FX_RATES is not valid JSON; ignoring');
      return {};
    }
  }
}
