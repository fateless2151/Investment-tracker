import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
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
import { PriceFeedService } from './price-feed.service';

@WebSocketGateway({
  namespace: PRICE_NAMESPACE,
  cors: { origin: process.env.WEB_ORIGIN?.split(',') ?? '*' },
})
export class PricesGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(PricesGateway.name);

  /** Symbols each client is subscribed to, so disconnects decrement correctly. */
  private readonly clientSymbols = new Map<string, Set<string>>();

  @WebSocketServer()
  server!: Server;

  constructor(private readonly feed: PriceFeedService) {}

  afterInit(server: Server) {
    // Hand the server to the feed so it can broadcast ticks.
    this.feed.setServer(server);
  }

  handleConnection(client: Socket) {
    this.clientSymbols.set(client.id, new Set());
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    // Socket.io auto-leaves rooms on disconnect; mirror that in the feed's
    // reference counts so the poller stops for symbols nobody is watching.
    const symbols = this.clientSymbols.get(client.id);
    symbols?.forEach((symbol) => this.feed.removeSubscriber(symbol));
    this.clientSymbols.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /** Client subscribes to a symbol → joins its room and starts the feed. */
  @SubscribeMessage(PriceEvents.Subscribe)
  onSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() symbol: string,
  ) {
    const key = symbol.toUpperCase();
    const symbols = this.clientSymbols.get(client.id);
    if (symbols?.has(key)) {
      return; // already subscribed; don't double-count
    }
    symbols?.add(key);
    client.join(key);
    this.feed.addSubscriber(key);
  }

  @SubscribeMessage(PriceEvents.Unsubscribe)
  onUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() symbol: string,
  ) {
    const key = symbol.toUpperCase();
    const symbols = this.clientSymbols.get(client.id);
    if (!symbols?.has(key)) {
      return;
    }
    symbols.delete(key);
    client.leave(key);
    this.feed.removeSubscriber(key);
  }

  /** Broadcast a price tick to everyone subscribed to that symbol. */
  broadcastPrice(update: PriceUpdate) {
    this.server.to(update.symbol.toUpperCase()).emit(PriceEvents.Update, update);
  }
}
