import { Module } from '@nestjs/common';
import { PricesModule } from '../prices/prices.module';
import { PricesGateway } from './prices.gateway';
import { PriceFeedService } from './price-feed.service';

@Module({
  imports: [PricesModule],
  providers: [PricesGateway, PriceFeedService],
  exports: [PricesGateway],
})
export class WebsocketModule {}
