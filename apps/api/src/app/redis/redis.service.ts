import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  /**
   * Lazily create the Redis connection. Returns null when REDIS_URL is not
   * configured so the app can boot in environments without a cache (callers
   * must handle a null client and fall back to the source of truth).
   */
  getClient(): Redis | null {
    if (this.client) return this.client;
    if (!process.env.REDIS_URL) {
      this.logger.warn('REDIS_URL not set — cache disabled');
      return null;
    }
    this.client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      lazyConnect: false,
    });
    this.client.on('error', (err) =>
      this.logger.error(`Redis error: ${err.message}`),
    );
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.getClient()?.get(key) ?? null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const client = this.getClient();
    if (!client) return;
    if (ttlSeconds) {
      await client.set(key, value, 'EX', ttlSeconds);
    } else {
      await client.set(key, value);
    }
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }
}
