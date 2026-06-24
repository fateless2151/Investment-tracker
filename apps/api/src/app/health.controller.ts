import { Controller, Get, Res } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './redis/redis.service';

type Check = { status: 'up' | 'down' | 'disabled'; error?: string };

/** Minimal slice of the platform response — just enough to set the status. */
interface ResponseLike {
  status(code: number): unknown;
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Liveness — cheap, always ok while the process is running. */
  @Get()
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /**
   * Readiness — probes dependencies. The database is required (503 when down);
   * Redis is best-effort since the app degrades gracefully without the cache.
   */
  @Get('ready')
  async readiness(@Res({ passthrough: true }) res: ResponseLike) {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);
    const ready = database.status === 'up';
    // Set the status directly so the detailed `checks` body survives (throwing
    // would be normalized by the global exception filter).
    res.status(ready ? 200 : 503);
    return {
      status: ready ? 'ok' : 'unavailable',
      checks: { database, redis },
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<Check> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up' };
    } catch (err) {
      return { status: 'down', error: (err as Error).message };
    }
  }

  private async checkRedis(): Promise<Check> {
    const client = this.redis.getClient();
    if (!client) return { status: 'disabled' };
    try {
      const pong = await client.ping();
      return { status: pong === 'PONG' ? 'up' : 'down' };
    } catch (err) {
      return { status: 'down', error: (err as Error).message };
    }
  }
}
