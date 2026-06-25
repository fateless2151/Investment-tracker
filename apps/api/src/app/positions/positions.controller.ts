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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PositionsService } from './positions.service';
import { CreatePositionDto } from './dto/create-position.dto';

type AuthedRequest = { user: { id: string } };

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
    @Req() req: AuthedRequest,
    @Param('portfolioId') portfolioId: string,
    @Body() dto: CreatePositionDto,
  ) {
    return this.positions.create(req.user.id, portfolioId, dto);
  }

  @Delete(':id')
  remove(
    @Req() req: AuthedRequest,
    @Param('portfolioId') portfolioId: string,
    @Param('id') id: string,
  ) {
    return this.positions.remove(req.user.id, portfolioId, id);
  }
}
