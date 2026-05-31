'use strict';
// Unit tests for the DGD config helpers (pure logic, no DB/network).

const dgd = require('../src/config/dgd');

describe('dgd.toSats — decimal DGD → integer sats string (8dp)', () => {
  it('handles whole numbers', () => {
    expect(dgd.toSats('1')).toBe('100000000');
    expect(dgd.toSats(5)).toBe('500000000');
  });

  it('handles fractional amounts', () => {
    expect(dgd.toSats('1.5')).toBe('150000000');
    expect(dgd.toSats('0.00000001')).toBe('1');       // 1 sat
    expect(dgd.toSats('0.1')).toBe('10000000');
  });

  it('truncates beyond 8 decimal places (float artifacts)', () => {
    // 0.1 * 3 in JS is 0.30000000000000004 — must not overflow past 8dp
    expect(dgd.toSats(0.1 * 3)).toBe('30000000');
  });

  it('handles zero', () => {
    expect(dgd.toSats('0')).toBe('0');
    expect(dgd.toSats(0)).toBe('0');
  });
});

describe('dgd.assertSettlementIsDgd', () => {
  it('passes for DGD', () => {
    expect(() => dgd.assertSettlementIsDgd('DGD')).not.toThrow();
  });
  it('throws for anything else', () => {
    expect(() => dgd.assertSettlementIsDgd('BTC')).toThrow(/DGD only/);
  });
});
