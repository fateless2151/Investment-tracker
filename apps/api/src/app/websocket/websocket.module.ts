import { Module } from '@nestjs/common';
import { PricesModule } from '../prices/prices.module';
import { PricesGateway } from './prices.gateway';

@Module({
  imports: [PricesModule],
  providers: [PricesGateway],
  exports: [PricesGateway],
})
export class WebsocketModule {}
