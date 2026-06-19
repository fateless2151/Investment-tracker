import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AssetType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(portfolioId: string) {
    return this.prisma.transaction.findMany({
      where: { portfolioId },
      orderBy: { executedAt: 'desc' },
    });
  }

  /**
   * Record a transaction and, for BUY/SELL, adjust the position it affects —
   * atomically, so the ledger and the position can never drift apart.
   *
   * - BUY  : increases quantity and recomputes the weighted-average cost basis,
   *          folding trade fees into cost. Opens the position if it's new.
   * - SELL : decreases quantity (rejects overselling); average cost is left
   *          unchanged for the remaining shares.
   * - DIVIDEND / DEPOSIT / WITHDRAWAL : cash events — recorded only, no position.
   *
   * TODO: persist realized P&L on SELL (needs a schema column) and model cash
   * balances for the dividend/deposit/withdrawal types.
   */
  async create(userId: string, dto: CreateTransactionDto) {
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id: dto.portfolioId, userId },
      select: { id: true },
    });
    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    const fees = dto.fees ?? 0;

    return this.prisma.$transaction(async (tx) => {
      let positionId: string | null = null;

      if (dto.type === 'BUY' || dto.type === 'SELL') {
        const position = await tx.position.findUnique({
          where: {
            portfolioId_symbol: {
              portfolioId: dto.portfolioId,
              symbol: dto.symbol,
            },
          },
        });
        positionId =
          dto.type === 'BUY'
            ? await this.applyBuy(tx, dto, fees, position)
            : await this.applySell(tx, dto, position);
      }

      return tx.transaction.create({
        data: {
          portfolioId: dto.portfolioId,
          positionId,
          type: dto.type,
          symbol: dto.symbol,
          quantity: dto.quantity,
          price: dto.price,
          fees,
          currency: dto.currency,
          executedAt: new Date(dto.executedAt),
        },
      });
    });
  }

  private async applyBuy(
    tx: Prisma.TransactionClient,
    dto: CreateTransactionDto,
    fees: number,
    position: { id: string; quantity: Prisma.Decimal; avgCostBasis: Prisma.Decimal } | null,
  ): Promise<string> {
    const addedCost = dto.quantity * dto.price + fees;

    if (!position) {
      const created = await tx.position.create({
        data: {
          portfolioId: dto.portfolioId,
          symbol: dto.symbol,
          assetType: dto.assetType ?? AssetType.STOCK,
          quantity: dto.quantity,
          avgCostBasis: addedCost / dto.quantity,
          currency: dto.currency,
        },
        select: { id: true },
      });
      return created.id;
    }

    const oldQty = Number(position.quantity);
    const oldAvg = Number(position.avgCostBasis);
    const newQty = oldQty + dto.quantity;
    const newAvg = (oldQty * oldAvg + addedCost) / newQty;

    await tx.position.update({
      where: { id: position.id },
      data: { quantity: newQty, avgCostBasis: newAvg },
    });
    return position.id;
  }

  private async applySell(
    tx: Prisma.TransactionClient,
    dto: CreateTransactionDto,
    position: { id: string; quantity: Prisma.Decimal } | null,
  ): Promise<string> {
    if (!position) {
      throw new BadRequestException(
        `Cannot sell ${dto.symbol}: no position held`,
      );
    }

    const oldQty = Number(position.quantity);
    if (dto.quantity > oldQty) {
      throw new BadRequestException(
        `Cannot sell ${dto.quantity} ${dto.symbol}: only ${oldQty} held`,
      );
    }

    await tx.position.update({
      where: { id: position.id },
      data: { quantity: oldQty - dto.quantity },
    });
    return position.id;
  }
}
