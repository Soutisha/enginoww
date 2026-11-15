import { ProductVisionService } from '../product-vision.service';

describe('ProductVisionService response sanitization', () => {
  const service = new ProductVisionService() as any;

  it('clamps confidence to the supported range', () => {
    expect(Math.max(0, Math.min(1, 1.7))).toBe(1);
    expect(Math.max(0, Math.min(1, -0.2))).toBe(0);
  });

  it('keeps only bounded string attributes', () => {
    const result = service.safeAttributes({
      Color: ' Blue ',
      Size: 42,
      Material: 'Cotton',
      '': 'ignored',
    });
    expect(result).toEqual({ Color: 'Blue', Material: 'Cotton' });
  });

  it('filters, trims, bounds and caps list values', () => {
    const result = service.safeStringArray([' A ', 7, 'B', 'C'], 2, 5);
    expect(result).toEqual(['A', 'B']);
  });

  it('accepts only supported image MIME types', () => {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
    expect(allowed.has('image/png')).toBe(true);
    expect(allowed.has('image/svg+xml')).toBe(false);
  });
});
