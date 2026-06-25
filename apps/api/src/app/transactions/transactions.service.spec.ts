import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import type { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

type ExistingPosition = {
  id: string;
  quantity: number;
  avgCostBasis: number;
} | null;

function setup(portfolio: { id: string } | null, position: ExistingPosition) {
  const tx = {
    position: {
      findUnique: jest.fn(async () => position),
      create: jest.fn(async () => ({ id: 'new-pos' })),
      update: jest.fn(async () => ({ id: position?.id ?? 'pos' })),
    },
    transaction: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'txn1',
        ...data,
      })),
    },
    cashBalance: {
      upsert: jest.fn(async () => ({ id: 'cash1' })),
    },
  };
  const prisma = {
    portfolio: { findFirst: jest.fn(async () => portfolio) },
    $transaction: jest.fn(async (cb: (c: typeof tx) => unknown) => cb(tx)),
  };
  const service = new TransactionsService(prisma as unknown as PrismaService);
  return { service, prisma, tx };
}

function dto(overrides: Partial<CreateTransactionDto>): CreateTransactionDto {
  return {
    portfolioId: 'p1',
    type: 'BUY',
    symbol: 'AAPL',
    quantity: 10,
    price: 100,
    currency: 'USD',
    executedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('TransactionsService.create', () => {
  it('opens a new position on a BUY, folding fees into cost basis', async () => {
    const { service, tx } = setup({ id: 'p1' }, null);

    await service.create('u1', dto({ type: 'BUY', quantity: 5, price: 200, fees: 10 }));

    // avg = (5*200 + 10) / 5 = 202
    expect(tx.position.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ quantity: 5, avgCostBasis: 202 }),
      }),
    );
    expect(tx.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          positionId: 'new-pos',
          type: 'BUY',
          realizedPnl: null,
        }),
      }),
    );
  });

  it('recomputes the weighted-average cost basis when adding to a position', async () => {
    const { service, tx } = setup(
      { id: 'p1' },
      { id: 'pos1', quantity: 10, avgCostBasis: 100 },
    );

    await service.create('u1', dto({ type: 'BUY', quantity: 10, price: 120 }));

    // newQty = 20 ; newAvg = (10*100 + 10*120) / 20 = 110
    expect(tx.position.update).toHaveBeenCalledWith({
      where: { id: 'pos1' },
      data: { quantity: 20, avgCostBasis: 110 },
    });
  });

  it('reduces quantity on a SELL and leaves average cost unchanged', async () => {
    const { service, tx } = setup(
      { id: 'p1' },
      { id: 'pos1', quantity: 10, avgCostBasis: 100 },
    );

    await service.create('u1', dto({ type: 'SELL', quantity: 4, price: 150 }));

    expect(tx.position.update).toHaveBeenCalledWith({
      where: { id: 'pos1' },
      data: { quantity: 6 },
    });
  });

  it('books realized P&L net of fees on a SELL', async () => {
    const { service, tx } = setup(
      { id: 'p1' },
      { id: 'pos1', quantity: 10, avgCostBasis: 100 },
    );

    await service.create(
      'u1',
      dto({ type: 'SELL', quantity: 2, price: 150, fees: 10 }),
    );

    // 2 * (150 - 100) - 10 = 90
    expect(tx.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ realizedPnl: 90 }),
      }),
    );
  });

  it('rejects selling more than is held', async () => {
    const { service } = setup(
      { id: 'p1' },
      { id: 'pos1', quantity: 3, avgCostBasis: 100 },
    );

    await expect(
      service.create('u1', dto({ type: 'SELL', quantity: 5 })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects selling a symbol with no position', async () => {
    const { service } = setup({ id: 'p1' }, null);

    await expect(
      service.create('u1', dto({ type: 'SELL', quantity: 1 })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('records a DIVIDEND without touching positions', async () => {
    const { service, tx } = setup({ id: 'p1' }, null);

    await service.create('u1', dto({ type: 'DIVIDEND', quantity: 1, price: 2 }));

    expect(tx.position.findUnique).not.toHaveBeenCalled();
    expect(tx.position.update).not.toHaveBeenCalled();
    expect(tx.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          positionId: null,
          type: 'DIVIDEND',
          realizedPnl: null,
        }),
      }),
    );
  });

  it('throws NotFound when the portfolio is not the user\'s', async () => {
    const { service } = setup(null, null);

    await expect(service.create('u1', dto({}))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('debits cash on a BUY (gross + fees out)', async () => {
    const { service, tx } = setup({ id: 'p1' }, null);

    await service.create('u1', dto({ type: 'BUY', quantity: 10, price: 100, fees: 5 }));

    // -(10*100 + 5) = -1005
    expect(tx.cashBalance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ currency: 'USD', amount: -1005 }),
        update: { amount: { increment: -1005 } },
      }),
    );
  });

  it('credits cash on a DEPOSIT (gross - fees in)', async () => {
    const { service, tx } = setup({ id: 'p1' }, null);

    await service.create(
      'u1',
      dto({ type: 'DEPOSIT', symbol: 'CASH', quantity: 1000, price: 1, fees: 0 }),
    );

    expect(tx.cashBalance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ amount: 1000 }),
        update: { amount: { increment: 1000 } },
      }),
    );
  });

  it('debits cash on a WITHDRAWAL', async () => {
    const { service, tx } = setup({ id: 'p1' }, null);

    await service.create(
      'u1',
      dto({ type: 'WITHDRAWAL', symbol: 'CASH', quantity: 200, price: 1, fees: 0 }),
    );

    expect(tx.cashBalance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { amount: { increment: -200 } },
      }),
    );
  });
});
