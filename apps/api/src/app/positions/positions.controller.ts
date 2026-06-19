import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { CreatePositionDto } from '@investment-tracker/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PositionsService } from './positions.service';

@UseGuards(JwtAuthGuard)
@Controller('portfolios/:portfolioId/positions')
export class PositionsController {
  constructor(private readonly positions: PositionsService) {}

  @Get()
  findAll(@Param('portfolioId') portfolioId: string) {
    return this.positions.findAll(portfolioId);
  }

  @Post()
  create(
    @Param('portfolioId') portfolioId: string,
    @Body() dto: CreatePositionDto,
  ) {
    return this.positions.create(portfolioId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.positions.remove(id);
  }
}
