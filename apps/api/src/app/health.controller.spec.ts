import { HealthController } from './health.controller';
import type { PrismaService } from './prisma/prisma.service';
import type { RedisService } from './redis/redis.service';

function make(
  dbOk: boolean,
  redisClient: { ping: () => Promise<string> } | null,
) {
  const prisma = {
    $queryRaw: jest.fn(async () => {
      if (!dbOk) throw new Error('db down');
      return [{ '?column?': 1 }];
    }),
  };
  const redis = { getClient: jest.fn(() => redisClient) };
  const controller = new HealthController(
    prisma as unknown as PrismaService,
    redis as unknown as RedisService,
  );
  const status = jest.fn();
  const res = { status } as unknown as Parameters<
    HealthController['readiness']
  >[0];
  return { controller, res, status };
}

describe('HealthController', () => {
  it('liveness is always ok', () => {
    const { controller } = make(true, { ping: async () => 'PONG' });
    expect(controller.liveness().status).toBe('ok');
  });

  it('readiness reports ok (200) when DB and Redis respond', async () => {
    const { controller, res, status } = make(true, { ping: async () => 'PONG' });
    const body = await controller.readiness(res);
    expect(status).toHaveBeenCalledWith(200);
    expect(body.status).toBe('ok');
    expect(body.checks.database.status).toBe('up');
    expect(body.checks.redis.status).toBe('up');
  });

  it('readiness stays ok with Redis disabled (best-effort)', async () => {
    const { controller, res, status } = make(true, null);
    const body = await controller.readiness(res);
    expect(status).toHaveBeenCalledWith(200);
    expect(body.checks.redis.status).toBe('disabled');
  });

  it('readiness returns 503 with details when the database is down', async () => {
    const { controller, res, status } = make(false, { ping: async () => 'PONG' });
    const body = await controller.readiness(res);
    expect(status).toHaveBeenCalledWith(503);
    expect(body.status).toBe('unavailable');
    expect(body.checks.database.status).toBe('down');
  });
});
