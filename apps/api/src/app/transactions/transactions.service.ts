import { Injectable } from '@nestjs/common';
import type { CreateTransactionDto } from '@investment-tracker/shared-types';
import { PrismaService } from '../prisma/prisma.service';

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
   * Record a transaction. In a full implementation this also updates the
   * affected position's quantity and average cost basis inside a single
   * Prisma transaction — that cost-basis math belongs here in the service.
   */
  create(dto: CreateTransactionDto) {
    return this.prisma.transaction.create({
      data: {
        portfolioId: dto.portfolioId,
        type: dto.type,
        symbol: dto.symbol,
        quantity: dto.quantity,
        price: dto.price,
        fees: dto.fees ?? 0,
        currency: dto.currency,
        executedAt: new Date(dto.executedAt),
      },
    });
  }
}
