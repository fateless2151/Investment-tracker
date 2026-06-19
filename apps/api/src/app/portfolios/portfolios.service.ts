import { Injectable } from '@nestjs/common';
import type {
  CreatePortfolioDto,
  PortfolioValuation,
} from '@investment-tracker/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PortfoliosService {
  constructor(private readonly prisma: PrismaService) {}

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
   * Compute market value, cost basis and unrealized P&L.
   * Financial math lives here in the service — never in the controller.
   * TODO: pull live prices from PricesService and aggregate positions.
   */
  async valuation(_userId: string, _id: string): Promise<PortfolioValuation> {
    throw new Error('Not implemented');
  }
}
