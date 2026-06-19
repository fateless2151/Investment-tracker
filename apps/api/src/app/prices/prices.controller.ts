import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PricesService } from './prices.service';

@UseGuards(JwtAuthGuard)
@Controller('prices')
export class PricesController {
  constructor(private readonly prices: PricesService) {}

  @Get(':symbol')
  getQuote(
    @Param('symbol') symbol: string,
    @Query('currency') currency = 'USD',
  ) {
    return this.prices.getQuote(symbol, currency);
  }
}
