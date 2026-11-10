import { describe, expect, it } from 'vitest';
import { feeRequestHash, ledgerSum } from '../../src/modules/fees/fees.service.js';

describe('fee math and idempotency helpers', () => {
  it('sums signed ledger entries in paise', () => {
    expect(ledgerSum([{ amount_paise: 15000 }, { amount_paise: -5000 }])).toBe(10000);
  });

  it('produces a stable request hash and changes it when the body changes', () => {
    const first = feeRequestHash('507f1f77bcf86cd799439011', {
      amountPaise: 1000,
      method: 'SIMULATED_CARD',
      simulatedStatus: 'SUCCEEDED',
    });
    expect(first).toBe(feeRequestHash('507f1f77bcf86cd799439011', {
      amountPaise: 1000,
      method: 'SIMULATED_CARD',
      simulatedStatus: 'SUCCEEDED',
    }));
    expect(first).not.toBe(feeRequestHash('507f1f77bcf86cd799439011', {
      amountPaise: 1001,
      method: 'SIMULATED_CARD',
      simulatedStatus: 'SUCCEEDED',
    }));
  });
});
