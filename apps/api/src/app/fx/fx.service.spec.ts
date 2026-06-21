import axios from 'axios';
import { FxService } from './fx.service';
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

describe('FxService', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    mockedAxios.get.mockReset();
    delete process.env.FX_RATES;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns 1 for same-currency without any lookup', async () => {
    const fx = new FxService(makeRedis());

    expect(await fx.getRate('USD', 'USD')).toBe(1);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('fetches and parses a rate from Frankfurter', async () => {
    mockedAxios.get.mockResolvedValue({ data: { rates: { USD: 1.1 } } });
    const fx = new FxService(makeRedis());

    const rate = await fx.getRate('EUR', 'USD');

    expect(rate).toBe(1.1);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://api.frankfurter.app/latest',
      expect.objectContaining({ params: { from: 'EUR', to: 'USD' } }),
    );
  });

  it('serves a repeated lookup from the Redis cache', async () => {
    mockedAxios.get.mockResolvedValue({ data: { rates: { USD: 1.1 } } });
    const fx = new FxService(makeRedis());

    await fx.getRate('EUR', 'USD');
    await fx.getRate('EUR', 'USD');

    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it('falls back to 1 when the provider errors', async () => {
    mockedAxios.get.mockRejectedValue(new Error('network down'));
    const fx = new FxService(makeRedis());

    expect(await fx.getRate('EUR', 'USD')).toBe(1);
  });

  it('prefers an FX_RATES override and skips the network', async () => {
    process.env.FX_RATES = JSON.stringify({ 'EUR:USD': 1.25 });
    const fx = new FxService(makeRedis());

    expect(await fx.getRate('EUR', 'USD')).toBe(1.25);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });
});
