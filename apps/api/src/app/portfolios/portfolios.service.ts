import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AssetType,
  CreatePortfolioDto,
  PortfolioHistory,
  PortfolioValuation,
} from '@investment-tracker/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { PricesService } from '../prices/prices.service';
import { FxService } from '../fx/fx.service';

@Injectable()
export class PortfoliosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prices: PricesService,
    private readonly fx: FxService,
  ) {}

  /** Resolve a rate from each distinct currency to the base currency. */
  private async ratesToBase(
    currencies: string[],
    base: string,
  ): Promise<Map<string, number>> {
    const distinct = [...new Set(currencies)];
    const rates = new Map<string, number>();
    await Promise.all(
      distinct.map(async (ccy) => {
        rates.set(ccy, await this.fx.getRate(ccy, base));
      }),
    );
    return rates;
  }

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
   * Redis), in each position's currency, then converted to the base currency.
   * Cash balances are added in too: totalValue = marketValue + cash.
   */
  async valuation(userId: string, id: string): Promise<PortfolioValuation> {
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id, userId },
      include: { positions: true, cashBalances: true },
    });
    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    const { positions, cashBalances } = portfolio;
    const base = portfolio.baseCurrency;

    // Quote each distinct symbol in its own currency, carrying the asset type so
    // crypto routes to CoinGecko and equities to Finnhub.
    const metaBySymbol = new Map<
      string,
      { assetType: AssetType; currency: string }
    >();
    for (const pos of positions) {
      metaBySymbol.set(pos.symbol, {
        assetType: pos.assetType,
        currency: pos.currency,
      });
    }
    const priceBySymbol = new Map<string, number>();
    await Promise.all(
      [...metaBySymbol].map(async ([symbol, meta]) => {
        const quote = await this.prices.getQuote(
          symbol,
          meta.currency,
          meta.assetType,
        );
        priceBySymbol.set(symbol, quote.price);
      }),
    );

    // Convert positions and cash from their own currency into the base currency.
    const rateByCurrency = await this.ratesToBase(
      [
        ...positions.map((p) => p.currency),
        ...cashBalances.map((c) => c.currency),
      ],
      base,
    );

    let marketValue = 0;
    let costBasis = 0;
    for (const pos of positions) {
      const quantity = Number(pos.quantity);
      const rate = rateByCurrency.get(pos.currency) ?? 1;
      const price = priceBySymbol.get(pos.symbol) ?? 0;
      marketValue += quantity * price * rate;
      costBasis += quantity * Number(pos.avgCostBasis) * rate;
    }

    let cash = 0;
    for (const cb of cashBalances) {
      cash += Number(cb.amount) * (rateByCurrency.get(cb.currency) ?? 1);
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
      cash: round2(cash),
      totalValue: round2(marketValue + cash),
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
    const base = portfolio.baseCurrency;

    // Convert into the base currency with current rates. We don't store
    // historical FX, so earlier points use today's rate — a documented
    // approximation (single-currency portfolios are unaffected).
    const rateByCurrency = await this.ratesToBase(
      transactions.map((t) => t.currency),
      base,
    );

    const holdings = new Map<
      string,
      { qty: number; avg: number; currency: string }
    >();
    let cumulativeRealized = 0;
    const byDay = new Map<string, { costBasis: number; realizedPnl: number }>();

    for (const t of transactions) {
      const qty = Number(t.quantity);
      const price = Number(t.price);
      const fees = Number(t.fees);
      const rate = rateByCurrency.get(t.currency) ?? 1;

      if (t.type === 'BUY') {
        const held = holdings.get(t.symbol);
        const addedCost = qty * price + fees;
        if (held) {
          const newQty = held.qty + qty;
          held.avg = newQty > 0 ? (held.qty * held.avg + addedCost) / newQty : 0;
          held.qty = newQty;
        } else {
          holdings.set(t.symbol, {
            qty,
            avg: qty > 0 ? addedCost / qty : price,
            currency: t.currency,
          });
        }
      } else if (t.type === 'SELL') {
        const held = holdings.get(t.symbol);
        if (held) {
          held.qty = Math.max(0, held.qty - qty);
        }
        cumulativeRealized +=
          (t.realizedPnl != null ? Number(t.realizedPnl) : 0) * rate;
      }

      const costBasis = [...holdings.values()].reduce(
        (sum, h) => sum + h.qty * h.avg * (rateByCurrency.get(h.currency) ?? 1),
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
