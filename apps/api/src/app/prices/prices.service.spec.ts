import axios from 'axios';
import { PricesService } from './prices.service';
import type { RedisService } from '../redis/redis.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

function makeRedis(): RedisService {
  const store = new Map<string, string>();
  return {
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
  } as unknown as RedisService;
}

describe('PricesService', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    mockedAxios.get.mockReset();
    delete process.env.FINNHUB_API_KEY;
    delete process.env.COINGECKO_API_KEY;
    delete process.env.COINGECKO_ID_MAP;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('routes a known crypto symbol to CoinGecko and derives the change', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { bitcoin: { usd: 50000, usd_24h_change: 10 } },
    });
    const service = new PricesService(makeRedis());

    const quote = await service.getQuote('BTC', 'USD');

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://api.coingecko.com/api/v3/simple/price',
      expect.objectContaining({
        params: { ids: 'bitcoin', vs_currencies: 'usd', include_24hr_change: true },
      }),
    );
    expect(quote.price).toBe(50000);
    expect(quote.changePct).toBe(10);
    // change = 50000 - 50000 / 1.1
    expect(quote.change).toBeCloseTo(4545.45, 2);
  });

  it('routes equities to Finnhub when a key is configured', async () => {
    process.env.FINNHUB_API_KEY = 'test-key';
    mockedAxios.get.mockResolvedValue({ data: { c: 150, d: 1.5, dp: 1 } });
    const service = new PricesService(makeRedis());

    const quote = await service.getQuote('AAPL', 'USD');

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://finnhub.io/api/v1/quote',
      expect.objectContaining({ params: { symbol: 'AAPL', token: 'test-key' } }),
    );
    expect(quote.price).toBe(150);
    expect(quote.changePct).toBe(1);
  });

  it('honors an explicit CRYPTO asset type via the symbol map', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { ethereum: { eur: 3000, eur_24h_change: 0 } },
    });
    const service = new PricesService(makeRedis());

    const quote = await service.getQuote('ETH', 'EUR', 'CRYPTO');

    expect(quote.price).toBe(3000);
    expect(quote.currency).toBe('EUR');
  });

  it('returns a stub (no HTTP call) for crypto with no known CoinGecko ID', async () => {
    const service = new PricesService(makeRedis());

    const quote = await service.getQuote('NOTACOIN', 'USD', 'CRYPTO');

    expect(mockedAxios.get).not.toHaveBeenCalled();
    expect(quote.price).toBe(0);
  });

  it('serves the second identical request from the Redis cache', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { bitcoin: { usd: 50000, usd_24h_change: 0 } },
    });
    const service = new PricesService(makeRedis());

    await service.getQuote('BTC', 'USD');
    await service.getQuote('BTC', 'USD');

    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it('returns a stub instead of throwing when the provider errors', async () => {
    // CoinGecko rate-limits/blocks keyless cloud IPs; the caller must not 500.
    mockedAxios.get.mockRejectedValue(new Error('429 Too Many Requests'));
    const service = new PricesService(makeRedis());

    const quote = await service.getQuote('BTC', 'USD');

    expect(quote).toMatchObject({ symbol: 'BTC', price: 0, currency: 'USD' });
  });

  it('picks up symbol overrides from COINGECKO_ID_MAP', async () => {
    process.env.COINGECKO_ID_MAP = JSON.stringify({ pepe: 'pepe' });
    mockedAxios.get.mockResolvedValue({
      data: { pepe: { usd: 0.0001, usd_24h_change: 5 } },
    });
    const service = new PricesService(makeRedis());

    const quote = await service.getQuote('PEPE', 'USD', 'CRYPTO');

    expect(quote.price).toBe(0.0001);
  });
});
