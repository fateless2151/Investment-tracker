import { NotFoundException } from '@nestjs/common';
import { PortfoliosService } from './portfolios.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { PricesService } from '../prices/prices.service';

interface TestPosition {
  symbol: string;
  quantity: number;
  avgCostBasis: number;
}

function makeService(
  portfolio:
    | { id: string; baseCurrency: string; positions: TestPosition[] }
    | null,
  priceBySymbol: Record<string, number>,
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
  const service = new PortfoliosService(
    prisma as unknown as PrismaService,
    prices as unknown as PricesService,
  );
  return { service, prisma, prices };
}

describe('PortfoliosService.valuation', () => {
  it('computes market value, cost basis and unrealized P&L', async () => {
    const { service } = makeService(
      {
        id: 'p1',
        baseCurrency: 'USD',
        positions: [
          { symbol: 'AAPL', quantity: 10, avgCostBasis: 100 },
          { symbol: 'BTC', quantity: 2, avgCostBasis: 20000 },
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

  it('fetches each distinct symbol once, in the base currency', async () => {
    const { service, prices } = makeService(
      {
        id: 'p1',
        baseCurrency: 'EUR',
        positions: [
          { symbol: 'AAPL', quantity: 1, avgCostBasis: 10 },
          { symbol: 'MSFT', quantity: 1, avgCostBasis: 10 },
        ],
      },
      { AAPL: 12, MSFT: 8 },
    );

    await service.valuation('u1', 'p1');

    expect(prices.getQuote).toHaveBeenCalledTimes(2);
    expect(prices.getQuote).toHaveBeenCalledWith('AAPL', 'EUR');
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
