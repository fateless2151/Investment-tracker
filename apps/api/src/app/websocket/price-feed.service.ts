import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Server } from 'socket.io';
import { PriceEvents, type PriceUpdate } from '@investment-tracker/shared-types';
import { PricesService } from '../prices/prices.service';

const DEFAULT_INTERVAL_MS = 5000;

/**
 * Polls the market-data provider for every symbol that currently has at least
 * one subscribed client and broadcasts ticks to that symbol's Socket.io room.
 *
 * The gateway owns the socket connections and hands its server here via
 * {@link setServer}; this service owns the polling loop. Keeping the two apart
 * avoids a circular dependency (gateway → feed only).
 *
 * Subscriptions are reference-counted so the poller runs only while clients are
 * listening and stops as soon as the last one leaves.
 */
@Injectable()
export class PriceFeedService implements OnModuleDestroy {
  private readonly logger = new Logger(PriceFeedService.name);
  private readonly subscribers = new Map<string, number>();
  private readonly intervalMs: number;
  private readonly currency: string;

  private server: Server | null = null;
  private timer: NodeJS.Timeout | null = null;
  private polling = false;

  constructor(private readonly prices: PricesService) {
    const parsed = Number(process.env.PRICE_FEED_INTERVAL_MS);
    this.intervalMs =
      Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_INTERVAL_MS;
    this.currency = process.env.PRICE_FEED_CURRENCY ?? 'USD';
  }

  setServer(server: Server): void {
    this.server = server;
  }

  addSubscriber(symbol: string): void {
    const key = symbol.toUpperCase();
    this.subscribers.set(key, (this.subscribers.get(key) ?? 0) + 1);
    this.ensureRunning();
  }

  removeSubscriber(symbol: string): void {
    const key = symbol.toUpperCase();
    const next = (this.subscribers.get(key) ?? 0) - 1;
    if (next <= 0) {
      this.subscribers.delete(key);
    } else {
      this.subscribers.set(key, next);
    }
    if (this.subscribers.size === 0) {
      this.stop();
    }
  }

  /** Symbols currently being polled (uppercased). */
  activeSymbols(): string[] {
    return [...this.subscribers.keys()];
  }

  /**
   * Fetch the latest quote for every active symbol and broadcast it. Exposed
   * for the interval and for tests. Overlapping ticks are skipped so a slow
   * provider can't pile up requests.
   */
  async tick(): Promise<void> {
    if (this.polling || !this.server) {
      return;
    }
    const symbols = this.activeSymbols();
    if (symbols.length === 0) {
      return;
    }
    this.polling = true;
    try {
      await Promise.all(symbols.map((symbol) => this.publish(symbol)));
    } finally {
      this.polling = false;
    }
  }

  private async publish(symbol: string): Promise<void> {
    try {
      const quote = await this.prices.getQuote(symbol, this.currency);
      const update: PriceUpdate = {
        symbol: quote.symbol,
        price: quote.price,
        currency: quote.currency,
        timestamp: Date.now(),
      };
      this.server?.to(symbol).emit(PriceEvents.Update, update);
    } catch (err) {
      this.logger.warn(
        `Failed to publish ${symbol}: ${(err as Error).message}`,
      );
    }
  }

  private ensureRunning(): void {
    if (this.timer || this.subscribers.size === 0) {
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
    // Don't keep the process alive solely for the poller.
    this.timer.unref?.();
  }

  private stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  onModuleDestroy(): void {
    this.stop();
  }
}
