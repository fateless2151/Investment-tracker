import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AssetType,
  CreatePortfolioDto,
  PortfolioHistory,
  PortfolioValuation,
} from '@investment-tracker/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { PricesService } from '../prices/prices.service';

@Injectable()
export class PortfoliosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prices: PricesService,
  ) {}

  findAll(userId: string) {
    return this.prisma.portfolio.findMany({ where: { userId } });
  }

  findOne(userId: string, id: string) {
    return this.prisma.portfolio.findFirst({
      where: { id, userId },
      include: { positions: true },
    });
  }

  create(userId: string, dto: CreatePortfolioDto) {
    return this.prisma.portfolio.create({
      data: { ...dto, userId },
    });
  }

  remove(userId: string, id: string) {
    return this.prisma.portfolio.deleteMany({ where: { id, userId } });
  }

  /**
   * Value a portfolio against live market prices.
   *
   * For each position: marketValue += quantity * currentPrice and
   * costBasis += quantity * avgCostBasis. Unrealized P&L is the difference.
   * Quotes are fetched once per distinct symbol (PricesService caches them in
   * Redis), in the portfolio's base currency.
   *
   * NOTE: positions held in a currency other than the portfolio's base
   * currency are summed as-is — FX conversion is a TODO.
   */
  async valuation(userId: string, id: string): Promise<PortfolioValuation> {
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id, userId },
      include: { positions: true },
    });
    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    const { positions } = portfolio;

    // One quote per distinct symbol, carrying its asset type so crypto routes
    // to CoinGecko and equities to Finnhub.
    const assetTypeBySymbol = new Map<string, AssetType>();
    for (const pos of positions) {
      assetTypeBySymbol.set(pos.symbol, pos.assetType);
    }
    const priceBySymbol = new Map<string, number>();
    await Promise.all(
      [...assetTypeBySymbol].map(async ([symbol, assetType]) => {
        const quote = await this.prices.getQuote(
          symbol,
          portfolio.baseCurrency,
          assetType,
        );
        priceBySymbol.set(symbol, quote.price);
      }),
    );

    let marketValue = 0;
    let costBasis = 0;
    for (const pos of positions) {
      const quantity = Number(pos.quantity);
      const price = priceBySymbol.get(pos.symbol) ?? 0;
      marketValue += quantity * price;
      costBasis += quantity * Number(pos.avgCostBasis);
    }

    const unrealizedPnl = marketValue - costBasis;
    const unrealizedPnlPct =
      costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0;

    return {
      portfolioId: portfolio.id,
      marketValue: round2(marketValue),
      costBasis: round2(costBasis),
      unrealizedPnl: round2(unrealizedPnl),
      unrealizedPnlPct: round2(unrealizedPnlPct),
      currency: portfolio.baseCurrency,
      asOf: new Date().toISOString(),
    };
  }

  /**
   * Reconstruct a daily time series by replaying the transaction ledger.
   *
   * We don't store historical market prices, so this is derived purely from
   * trades: it tracks the cost basis of open positions (using the same
   * weighted-average logic as recording) and the cumulative realized P&L (read
   * from the persisted `realizedPnl` on sells) as of the end of each day a
   * transaction occurred. Market value over time would require a historical
   * price feed and is intentionally out of scope here.
   */
  async history(userId: string, id: string): Promise<PortfolioHistory> {
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id, userId },
      select: { id: true, baseCurrency: true },
    });
    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    const transactions = await this.prisma.transaction.findMany({
      where: { portfolioId: id },
      orderBy: { executedAt: 'asc' },
    });

    const holdings = new Map<string, { qty: number; avg: number }>();
    let cumulativeRealized = 0;
    const byDay = new Map<string, { costBasis: number; realizedPnl: number }>();

    for (const t of transactions) {
      const qty = Number(t.quantity);
      const price = Number(t.price);
      const fees = Number(t.fees);

      if (t.type === 'BUY') {
        const held = holdings.get(t.symbol);
        const addedCost = qty * price + fees;
        if (held) {
          const newQty = held.qty + qty;
          held.avg = newQty > 0 ? (held.qty * held.avg + addedCost) / newQty : 0;
          held.qty = newQty;
        } else {
          holdings.set(t.symbol, { qty, avg: qty > 0 ? addedCost / qty : price });
        }
      } else if (t.type === 'SELL') {
        const held = holdings.get(t.symbol);
        if (held) {
          held.qty = Math.max(0, held.qty - qty);
        }
        cumulativeRealized += t.realizedPnl != null ? Number(t.realizedPnl) : 0;
      }

      const costBasis = [...holdings.values()].reduce(
        (sum, h) => sum + h.qty * h.avg,
        0,
      );
      // Last write for a given day wins → end-of-day snapshot.
      const day = t.executedAt.toISOString().slice(0, 10);
      byDay.set(day, {
        costBasis: round2(costBasis),
        realizedPnl: round2(cumulativeRealized),
      });
    }

    const points = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, snapshot]) => ({ date, ...snapshot }));

    return {
      portfolioId: portfolio.id,
      currency: portfolio.baseCurrency,
      points,
    };
  }
}

/** Round to 2 decimals, guarding against binary-float artifacts. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
