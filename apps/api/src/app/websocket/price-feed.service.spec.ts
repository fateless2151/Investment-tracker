import { PriceFeedService } from './price-feed.service';
import type { PricesService } from '../prices/prices.service';

function makeServer() {
  const emit = jest.fn();
  const to = jest.fn(() => ({ emit }));
  return { server: { to } as never, to, emit };
}

function makePrices(priceBySymbol: Record<string, number>) {
  return {
    getQuote: jest.fn(async (symbol: string, currency: string) => ({
      symbol,
      price: priceBySymbol[symbol] ?? 0,
      currency,
      change: 0,
      changePct: 0,
      asOf: new Date().toISOString(),
    })),
  } as unknown as PricesService;
}

describe('PriceFeedService', () => {
  let feed: PriceFeedService;

  afterEach(() => feed?.onModuleDestroy());

  it('broadcasts a tick to each active symbol room on tick()', async () => {
    const prices = makePrices({ AAPL: 150 });
    feed = new PriceFeedService(prices);
    const { server, to, emit } = makeServer();
    feed.setServer(server);

    feed.addSubscriber('aapl');
    await feed.tick();

    expect(prices.getQuote).toHaveBeenCalledWith('AAPL', 'USD');
    expect(to).toHaveBeenCalledWith('AAPL');
    expect(emit).toHaveBeenCalledWith(
      'price:update',
      expect.objectContaining({ symbol: 'AAPL', price: 150, currency: 'USD' }),
    );
  });

  it('reference-counts subscribers and stops polling the symbol when all leave', () => {
    feed = new PriceFeedService(makePrices({}));
    feed.setServer(makeServer().server);

    feed.addSubscriber('AAPL');
    feed.addSubscriber('AAPL');
    feed.removeSubscriber('AAPL');
    expect(feed.activeSymbols()).toEqual(['AAPL']);

    feed.removeSubscriber('AAPL');
    expect(feed.activeSymbols()).toEqual([]);
  });

  it('does nothing on tick() before a server is registered', async () => {
    const prices = makePrices({ AAPL: 1 });
    feed = new PriceFeedService(prices);
    feed.addSubscriber('AAPL');

    await feed.tick();

    expect(prices.getQuote).not.toHaveBeenCalled();
  });

  it('swallows provider errors so one bad symbol does not kill the loop', async () => {
    const prices = {
      getQuote: jest
        .fn()
        .mockRejectedValueOnce(new Error('provider down'))
        .mockResolvedValueOnce({
          symbol: 'MSFT',
          price: 10,
          currency: 'USD',
          change: 0,
          changePct: 0,
          asOf: '',
        }),
    } as unknown as PricesService;
    feed = new PriceFeedService(prices);
    const { server, emit } = makeServer();
    feed.setServer(server);

    feed.addSubscriber('AAPL');
    feed.addSubscriber('MSFT');

    await expect(feed.tick()).resolves.toBeUndefined();
    // The healthy symbol still broadcast despite the other throwing.
    expect(emit).toHaveBeenCalledWith(
      'price:update',
      expect.objectContaining({ symbol: 'MSFT', price: 10 }),
    );
  });
});
