import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get('portfolio/:portfolioId')
  findAll(@Param('portfolioId') portfolioId: string) {
    return this.transactions.findAll(portfolioId);
  }

  @Post()
  create(
    @Req() req: { user: { id: string } },
    @Body() dto: CreateTransactionDto,
  ) {
    return this.transactions.create(req.user.id, dto);
  }
}
