import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { CreateTransactionDto } from '@investment-tracker/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TransactionsService } from './transactions.service';

@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get('portfolio/:portfolioId')
  findAll(@Param('portfolioId') portfolioId: string) {
    return this.transactions.findAll(portfolioId);
  }

  @Post()
  create(@Body() dto: CreateTransactionDto) {
    return this.transactions.create(dto);
  }
}
