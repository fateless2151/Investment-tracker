import { NotFoundException } from '@nestjs/common';
import { PortfoliosService } from './portfolios.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { PricesService } from '../prices/prices.service';
import type { FxService } from '../fx/fx.service';

interface TestPosition {
  symbol: string;
  assetType: string;
  quantity: number;
  avgCostBasis: number;
  currency?: string;
}

// FX rates keyed "FROM:TO"; anything not listed (and same-currency) is 1.
function makeFx(rates: Record<string, number> = {}) {
  return {
    getRate: jest.fn(async (from: string, to: string) =>
      from === to ? 1 : (rates[`${from}:${to}`] ?? 1),
    ),
  };
}

function makeService(
  portfolio:
    | { id: string; baseCurrency: string; positions: TestPosition[] }
    | null,
  priceBySymbol: Record<string, number>,
  fxRates: Record<string, number> = {},
) {
  const prisma = {
    portfolio: { findFirst: jest.fn(async () => portfolio) },
  };
  const prices = {
    getQuote: jest.fn(async (symbol: string, currency: string) => ({
      symbol,
      price: priceBySymbol[symbol] ?? 0,
      currency,
      change: 0,
      changePct: 0,
      asOf: new Date().toISOString(),
    })),
  };
  const fx = makeFx(fxRates);
  const service = new PortfoliosService(
    prisma as unknown as PrismaService,
    prices as unknown as PricesService,
    fx as unknown as FxService,
  );
  return { service, prisma, prices, fx };
}

describe('PortfoliosService.valuation', () => {
  it('computes market value, cost basis and unrealized P&L', async () => {
    const { service } = makeService(
      {
        id: 'p1',
        baseCurrency: 'USD',
        positions: [
          { symbol: 'AAPL', assetType: 'STOCK', quantity: 10, avgCostBasis: 100 },
          { symbol: 'BTC', assetType: 'CRYPTO', quantity: 2, avgCostBasis: 20000 },
        ],
      },
      { AAPL: 150, BTC: 25000 },
    );

    const v = await service.valuation('u1', 'p1');

    // market = 10*150 + 2*25000 = 51500 ; cost = 10*100 + 2*20000 = 41000
    expect(v.marketValue).toBe(51500);
    expect(v.costBasis).toBe(41000);
    expect(v.unrealizedPnl).toBe(10500);
    expect(v.unrealizedPnlPct).toBeCloseTo(25.61, 2);
    expect(v.currency).toBe('USD');
    expect(v.portfolioId).toBe('p1');
  });

  it('fetches each distinct symbol once, in its own currency', async () => {
    const { service, prices } = makeService(
      {
        id: 'p1',
        baseCurrency: 'EUR',
        positions: [
          { symbol: 'AAPL', assetType: 'STOCK', quantity: 1, avgCostBasis: 10, currency: 'EUR' },
          { symbol: 'MSFT', assetType: 'STOCK', quantity: 1, avgCostBasis: 10, currency: 'EUR' },
        ],
      },
      { AAPL: 12, MSFT: 8 },
    );

    await service.valuation('u1', 'p1');

    expect(prices.getQuote).toHaveBeenCalledTimes(2);
    expect(prices.getQuote).toHaveBeenCalledWith('AAPL', 'EUR', 'STOCK');
  });

  it('converts a foreign-currency position into the base currency', async () => {
    const { service, fx } = makeService(
      {
        id: 'p1',
        baseCurrency: 'USD',
        positions: [
          { symbol: 'SAP', assetType: 'STOCK', quantity: 10, avgCostBasis: 100, currency: 'EUR' },
        ],
      },
      { SAP: 150 },
      { 'EUR:USD': 1.1 },
    );

    const v = await service.valuation('u1', 'p1');

    // market = 10*150*1.1 = 1650 ; cost = 10*100*1.1 = 1100
    expect(v.marketValue).toBe(1650);
    expect(v.costBasis).toBe(1100);
    expect(v.unrealizedPnl).toBe(550);
    expect(v.unrealizedPnlPct).toBeCloseTo(50, 5);
    expect(fx.getRate).toHaveBeenCalledWith('EUR', 'USD');
  });

  it('returns zeros for an empty portfolio without fetching prices', async () => {
    const { service, prices } = makeService(
      { id: 'p1', baseCurrency: 'GBP', positions: [] },
      {},
    );

    const v = await service.valuation('u1', 'p1');

    expect(v).toMatchObject({
      marketValue: 0,
      costBasis: 0,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
      currency: 'GBP',
    });
    expect(prices.getQuote).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the portfolio does not exist', async () => {
    const { service } = makeService(null, {});

    await expect(service.valuation('u1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

interface TestTransaction {
  type: string;
  symbol: string;
  quantity: number;
  price: number;
  fees: number;
  realizedPnl: number | null;
  executedAt: Date;
  currency?: string;
}

function makeHistoryService(
  portfolio: { id: string; baseCurrency: string } | null,
  transactions: TestTransaction[],
  fxRates: Record<string, number> = {},
) {
  const prisma = {
    portfolio: { findFirst: jest.fn(async () => portfolio) },
    transaction: { findMany: jest.fn(async () => transactions) },
  };
  const service = new PortfoliosService(
    prisma as unknown as PrismaService,
    {} as unknown as PricesService,
    makeFx(fxRates) as unknown as FxService,
  );
  return { service, prisma };
}

describe('PortfoliosService.history', () => {
  it('replays trades into daily cost-basis and cumulative realized P&L', async () => {
    const { service } = makeHistoryService({ id: 'p1', baseCurrency: 'USD' }, [
      {
        type: 'BUY',
        symbol: 'AAPL',
        quantity: 10,
        price: 100,
        fees: 0,
        realizedPnl: null,
        executedAt: new Date('2026-01-01T10:00:00.000Z'),
      },
      {
        type: 'BUY',
        symbol: 'AAPL',
        quantity: 10,
        price: 120,
        fees: 0,
        realizedPnl: null,
        executedAt: new Date('2026-01-02T10:00:00.000Z'),
      },
      {
        type: 'SELL',
        symbol: 'AAPL',
        quantity: 4,
        price: 150,
        fees: 0,
        realizedPnl: 200,
        executedAt: new Date('2026-01-03T10:00:00.000Z'),
      },
    ]);

    const history = await service.history('u1', 'p1');

    expect(history.currency).toBe('USD');
    expect(history.points).toEqual([
      { date: '2026-01-01', costBasis: 1000, realizedPnl: 0 },
      { date: '2026-01-02', costBasis: 2200, realizedPnl: 0 }, // avg 110 × 20
      { date: '2026-01-03', costBasis: 1760, realizedPnl: 200 }, // 16 × 110
    ]);
  });

  it('collapses multiple same-day trades to the end-of-day snapshot', async () => {
    const { service } = makeHistoryService({ id: 'p1', baseCurrency: 'USD' }, [
      {
        type: 'BUY',
        symbol: 'AAPL',
        quantity: 5,
        price: 100,
        fees: 0,
        realizedPnl: null,
        executedAt: new Date('2026-01-01T09:00:00.000Z'),
      },
      {
        type: 'BUY',
        symbol: 'AAPL',
        quantity: 5,
        price: 100,
        fees: 0,
        realizedPnl: null,
        executedAt: new Date('2026-01-01T15:00:00.000Z'),
      },
    ]);

    const history = await service.history('u1', 'p1');

    expect(history.points).toEqual([
      { date: '2026-01-01', costBasis: 1000, realizedPnl: 0 },
    ]);
  });

  it('returns an empty series when there are no transactions', async () => {
    const { service } = makeHistoryService({ id: 'p1', baseCurrency: 'EUR' }, []);

    const history = await service.history('u1', 'p1');

    expect(history.points).toEqual([]);
  });

  it('throws NotFoundException when the portfolio does not exist', async () => {
    const { service } = makeHistoryService(null, []);

    await expect(service.history('u1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('converts foreign-currency trades into the base currency', async () => {
    const { service } = makeHistoryService(
      { id: 'p1', baseCurrency: 'USD' },
      [
        {
          type: 'BUY',
          symbol: 'SAP',
          quantity: 10,
          price: 100,
          fees: 0,
          realizedPnl: null,
          currency: 'EUR',
          executedAt: new Date('2026-01-01T10:00:00.000Z'),
        },
      ],
      { 'EUR:USD': 1.2 },
    );

    const history = await service.history('u1', 'p1');

    // cost basis 10*100 EUR = 1000 EUR -> 1200 USD
    expect(history.points).toEqual([
      { date: '2026-01-01', costBasis: 1200, realizedPnl: 0 },
    ]);
  });
});
