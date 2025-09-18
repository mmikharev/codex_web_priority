import { describe, expect, it } from 'vitest';
import { formatDate, parseLooseDate } from './date';

describe('parseLooseDate', () => {
  it('parses DD. M. YYYY at HH:MM format', () => {
    const date = parseLooseDate('1. 10. 2025 at 0:00');
    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(2025);
    expect(date?.getMonth()).toBe(9);
    expect(date?.getDate()).toBe(1);
    expect(date?.getHours()).toBe(0);
    expect(date?.getMinutes()).toBe(0);
  });

  it('returns null for invalid strings', () => {
    expect(parseLooseDate('invalid date')).toBeNull();
    expect(parseLooseDate('')).toBeNull();
    expect(parseLooseDate(null)).toBeNull();
  });
});

describe('formatDate', () => {
  it('renders human readable value', () => {
    const formatted = formatDate('1. 10. 2025 at 0:00');
    expect(formatted).toBeTypeOf('string');
  });

  it('returns placeholder for empty input', () => {
    expect(formatDate('')).toBe('Без даты');
    expect(formatDate(null)).toBe('Без даты');
  });
});
