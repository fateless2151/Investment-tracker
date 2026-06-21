import { NotFoundException } from '@nestjs/common';
import { PositionsService } from './positions.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { TransactionsService } from '../transactions/transactions.service';

type TestPosition = {
  id: string;
  symbol: string;
  quantity: number;
  avgCostBasis: number;
  currency: string;
} | null;

function setup(position: TestPosition) {
  const transactions = { create: jest.fn(async () => ({ id: 'txn1' })) };
  const prisma = {
    position: {
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(async () => position),
      findFirst: jest.fn(async () => position),
      delete: jest.fn(async () => position),
    },
  };
  const service = new PositionsService(
    prisma as unknown as PrismaService,
    transactions as unknown as TransactionsService,
  );
  return { service, prisma, transactions };
}

describe('PositionsService', () => {
  it('records a BUY when adding a position', async () => {
    const { service, transactions } = setup({
      id: 'pos1',
      symbol: 'AAPL',
      quantity: 5,
      avgCostBasis: 200,
      currency: 'USD',
    });

    await service.create('u1', 'p1', {
      symbol: 'AAPL',
      assetType: 'STOCK',
      quantity: 5,
      avgCostBasis: 200,
      currency: 'USD',
    });

    expect(transactions.create).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        portfolioId: 'p1',
        type: 'BUY',
        symbol: 'AAPL',
        quantity: 5,
        price: 200, // price = avgCostBasis
        fees: 0,
        currency: 'USD',
        assetType: 'STOCK',
      }),
    );
  });

  it('records a closing SELL then deletes when removing a position', async () => {
    const { service, prisma, transactions } = setup({
      id: 'pos1',
      symbol: 'AAPL',
      quantity: 8,
      avgCostBasis: 110,
      currency: 'USD',
    });

    await service.remove('u1', 'p1', 'pos1');

    expect(transactions.create).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        type: 'SELL',
        symbol: 'AAPL',
        quantity: 8,
        price: 110, // sold at average cost → realized P&L 0
      }),
    );
    expect(prisma.position.delete).toHaveBeenCalledWith({
      where: { id: 'pos1' },
    });
  });

  it('throws NotFound when removing a position that is not the user\'s', async () => {
    const { service, transactions } = setup(null);

    await expect(service.remove('u1', 'p1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(transactions.create).not.toHaveBeenCalled();
  });
});
