import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import type { PrismaService } from '../prisma/prisma.service';

const jwt = { sign: jest.fn(() => 'signed-token') };

function makePrisma(existingUser: unknown) {
  return {
    user: {
      findUnique: jest.fn(async () => existingUser),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'u1',
        email: data.email,
        passwordHash: data.passwordHash,
        name: data.name ?? null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      })),
    },
  };
}

function makeService(prisma: ReturnType<typeof makePrisma>) {
  return new AuthService(
    prisma as unknown as PrismaService,
    jwt as never,
  );
}

describe('AuthService', () => {
  beforeEach(() => jwt.sign.mockClear());

  it('registers a new user, hashes the password and returns a token', async () => {
    const prisma = makePrisma(null);
    const service = makeService(prisma);

    const res = await service.register({
      email: 'a@b.com',
      password: 'password123',
      name: 'Ada',
    });

    expect(res.accessToken).toBe('signed-token');
    expect(res.user.email).toBe('a@b.com');
    expect(
      (res.user as unknown as Record<string, unknown>).passwordHash,
    ).toBeUndefined();

    const created = prisma.user.create.mock.calls[0][0].data;
    expect(created.passwordHash).not.toBe('password123');
    expect(await bcrypt.compare('password123', created.passwordHash as string)).toBe(
      true,
    );
  });

  it('rejects registration when the email already exists', async () => {
    const prisma = makePrisma({ id: 'u1', email: 'a@b.com' });
    const service = makeService(prisma);

    await expect(
      service.register({ email: 'a@b.com', password: 'password123' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in with valid credentials', async () => {
    const passwordHash = await bcrypt.hash('password123', 4);
    const prisma = makePrisma({
      id: 'u1',
      email: 'a@b.com',
      passwordHash,
      name: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const service = makeService(prisma);

    const res = await service.login({
      email: 'a@b.com',
      password: 'password123',
    });

    expect(res.accessToken).toBe('signed-token');
    expect(res.user.id).toBe('u1');
  });

  it('rejects login with a wrong password', async () => {
    const passwordHash = await bcrypt.hash('password123', 4);
    const prisma = makePrisma({
      id: 'u1',
      email: 'a@b.com',
      passwordHash,
      name: null,
      createdAt: new Date(),
    });
    const service = makeService(prisma);

    await expect(
      service.login({ email: 'a@b.com', password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects login for an unknown email', async () => {
    const prisma = makePrisma(null);
    const service = makeService(prisma);

    await expect(
      service.login({ email: 'nobody@b.com', password: 'password123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
