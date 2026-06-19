import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  PRICE_NAMESPACE,
  PriceEvents,
  type PriceUpdate,
} from '@investment-tracker/shared-types';
import { PricesService } from '../prices/prices.service';

@WebSocketGateway({
  namespace: PRICE_NAMESPACE,
  cors: { origin: process.env.WEB_ORIGIN?.split(',') ?? '*' },
})
export class PricesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(PricesGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly prices: PricesService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /** Client subscribes to a symbol → joins a room keyed by symbol. */
  @SubscribeMessage(PriceEvents.Subscribe)
  onSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() symbol: string,
  ) {
    client.join(symbol.toUpperCase());
  }

  @SubscribeMessage(PriceEvents.Unsubscribe)
  onUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() symbol: string,
  ) {
    client.leave(symbol.toUpperCase());
  }

  /** Broadcast a price tick to everyone subscribed to that symbol. */
  broadcastPrice(update: PriceUpdate) {
    this.server.to(update.symbol.toUpperCase()).emit(PriceEvents.Update, update);
  }
}
