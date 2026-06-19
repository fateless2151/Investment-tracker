import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreatePortfolioDto,
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

    const symbols = [...new Set(positions.map((p) => p.symbol))];
    const priceBySymbol = new Map<string, number>();
    await Promise.all(
      symbols.map(async (symbol) => {
        const quote = await this.prices.getQuote(symbol, portfolio.baseCurrency);
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
}

/** Round to 2 decimals, guarding against binary-float artifacts. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
