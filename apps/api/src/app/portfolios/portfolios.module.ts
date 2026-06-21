import { Module } from '@nestjs/common';
import { PricesModule } from '../prices/prices.module';
import { FxModule } from '../fx/fx.module';
import { PortfoliosService } from './portfolios.service';
import { PortfoliosController } from './portfolios.controller';

@Module({
  imports: [PricesModule, FxModule],
  controllers: [PortfoliosController],
  providers: [PortfoliosService],
  exports: [PortfoliosService],
})
export class PortfoliosModule {}
