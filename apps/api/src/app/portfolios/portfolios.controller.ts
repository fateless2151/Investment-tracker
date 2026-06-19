import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { CreatePortfolioDto } from '@investment-tracker/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PortfoliosService } from './portfolios.service';

type AuthedRequest = { user: { id: string } };

@UseGuards(JwtAuthGuard)
@Controller('portfolios')
export class PortfoliosController {
  constructor(private readonly portfolios: PortfoliosService) {}

  @Get()
  findAll(@Req() req: AuthedRequest) {
    return this.portfolios.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.portfolios.findOne(req.user.id, id);
  }

  @Get(':id/valuation')
  valuation(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.portfolios.valuation(req.user.id, id);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreatePortfolioDto) {
    return this.portfolios.create(req.user.id, dto);
  }

  @Delete(':id')
  remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.portfolios.remove(req.user.id, id);
  }
}
