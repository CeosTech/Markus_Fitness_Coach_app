import { describe, expect, it } from 'vitest';
import {
  buildOptimizedList,
  formatQuantity,
  inferCategory,
  parseQuantity
} from '../utils/shoppingOptimizer';

describe('shoppingOptimizer utilities', () => {
  it('parses quantities with units', () => {
    expect(parseQuantity('500g chicken')).toEqual({ quantity: 500, unit: 'g' });
    expect(parseQuantity('1.5 kg rice')).toEqual({ quantity: 1.5, unit: 'kg' });
    expect(parseQuantity('2x avocado')).toEqual({ quantity: 2, unit: 'unit' });
    expect(parseQuantity('no quantity')).toEqual({ quantity: 1, unit: null });
  });

  it('infers categories from keywords', () => {
    expect(inferCategory('chicken breast')).toBe('protein');
    expect(inferCategory('broccoli florets')).toBe('produce');
    expect(inferCategory('oats')).toBe('carbs');
    expect(inferCategory('mystery item')).toBe('pantry');
  });

  it('aggregates items and estimates cost', () => {
    const { aggregated, totalCost } = buildOptimizedList([
      'Chicken breast (1 kg)',
      'chicken breast 500g',
      'Rice 1kg',
      'Rice 500 g'
    ]);

    const chicken = aggregated.find(i => i.name.toLowerCase().includes('chicken'));
    const rice = aggregated.find(i => i.name.toLowerCase().includes('rice'));

    expect(chicken?.quantity).toBeCloseTo(1.5, 2);
    expect(rice?.quantity).toBeCloseTo(1.5, 2);
    expect(totalCost).toBeGreaterThan(0);
  });

  it('formats quantities nicely', () => {
    expect(formatQuantity(1.234, 'kg')).toBe('1.23 kg');
    expect(formatQuantity(500, 'g')).toBe('500 g');
    expect(formatQuantity(2, null)).toBe('2.0 pcs');
  });
});
