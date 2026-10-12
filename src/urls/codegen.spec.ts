import { generateShortCode } from './urls.service';

describe('generateShortCode', () => {
  it('generates 7-char codes by default', () => {
    expect(generateShortCode()).toMatch(/^[0-9A-Za-z]{7}$/);
  });

  it('uses only Base62 characters at any length', () => {
    expect(generateShortCode(12)).toMatch(/^[0-9A-Za-z]{12}$/);
  });

  it('produces distinct codes across 500 draws', () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateShortCode()));
    expect(codes.size).toBe(500);
  });
});
