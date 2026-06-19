import { Injectable } from '@nestjs/common';
import type { CreatePositionDto } from '@investment-tracker/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PositionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(portfolioId: string) {
    return this.prisma.position.findMany({ where: { portfolioId } });
  }

  create(portfolioId: string, dto: CreatePositionDto) {
    return this.prisma.position.create({
      data: { ...dto, portfolioId },
    });
  }

  remove(id: string) {
    return this.prisma.position.delete({ where: { id } });
  }
}
