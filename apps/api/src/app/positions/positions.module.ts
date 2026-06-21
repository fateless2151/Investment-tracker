import { Module } from '@nestjs/common';
import { TransactionsModule } from '../transactions/transactions.module';
import { PositionsService } from './positions.service';
import { PositionsController } from './positions.controller';

@Module({
  imports: [TransactionsModule],
  controllers: [PositionsController],
  providers: [PositionsService],
  exports: [PositionsService],
})
export class PositionsModule {}
