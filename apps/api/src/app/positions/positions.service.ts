import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreatePositionDto } from '@investment-tracker/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';

@Injectable()
export class PositionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionsService,
  ) {}

  findAll(portfolioId: string) {
    return this.prisma.position.findMany({ where: { portfolioId } });
  }

  /**
   * Adding a position is recorded as a BUY in the ledger so history (which
   * replays transactions) and valuation (which reads positions) stay
   * consistent. The transaction creates/updates the position as a side effect
   * — with no fees the resulting average cost equals the supplied avgCostBasis.
   * Dated "now"; ownership is enforced by the transaction.
   */
  async create(userId: string, portfolioId: string, dto: CreatePositionDto) {
    await this.transactions.create(userId, {
      portfolioId,
      type: 'BUY',
      symbol: dto.symbol,
      quantity: dto.quantity,
      price: dto.avgCostBasis,
      fees: 0,
      currency: dto.currency,
      assetType: dto.assetType,
      executedAt: new Date().toISOString(),
    });

    return this.prisma.position.findUnique({
      where: { portfolioId_symbol: { portfolioId, symbol: dto.symbol } },
    });
  }

  /**
   * Removing a position records a closing SELL of the full remaining quantity
   * at average cost (so realized P&L is zero) before deleting the row, keeping
   * the ledger complete.
   */
  async remove(userId: string, portfolioId: string, id: string) {
    const position = await this.prisma.position.findFirst({
      where: { id, portfolio: { id: portfolioId, userId } },
    });
    if (!position) {
      throw new NotFoundException('Position not found');
    }

    const quantity = Number(position.quantity);
    if (quantity > 0) {
      await this.transactions.create(userId, {
        portfolioId,
        type: 'SELL',
        symbol: position.symbol,
        quantity,
        price: Number(position.avgCostBasis),
        fees: 0,
        currency: position.currency,
        executedAt: new Date().toISOString(),
      });
    }

    return this.prisma.position.delete({ where: { id: position.id } });
  }
}
