import { describe, expect, it } from 'vitest';
import { formatMoney, formatNumber, formatPct, toNumber } from './format';

describe('format utilities', () => {
  it('coerces Prisma decimal strings to numbers', () => {
    expect(toNumber('10.5')).toBe(10.5);
    expect(toNumber(3)).toBe(3);
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber('not-a-number')).toBe(0);
  });

  it('formats percentages with a sign', () => {
    expect(formatPct(25.607)).toBe('+25.61%');
    expect(formatPct('-4')).toBe('-4.00%');
    expect(formatPct(0)).toBe('+0.00%');
  });

  it('formats money including the numeric amount', () => {
    expect(formatMoney('1234.5', 'USD')).toContain('1,234.5');
    expect(formatMoney(0, 'USD')).toContain('0');
  });

  it('formats numbers from decimal strings', () => {
    expect(formatNumber('1000')).toBe('1,000');
  });
});
