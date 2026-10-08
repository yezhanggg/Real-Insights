import { describe, expect, it } from 'vitest';
import { cleanEmail } from './subscribe';

describe('cleanEmail', () => {
  it('accepts and normalizes a normal address', () => {
    expect(cleanEmail({ email: '  Ye@Example.COM ', source: 'home' })).toEqual({ email: 'ye@example.com', source: 'home' });
  });
  it('rejects junk', () => {
    expect(cleanEmail({ email: 'nope' })).toBeNull();
    expect(cleanEmail({ email: 'a@b' })).toBeNull();
    expect(cleanEmail('not json')).toBeNull();
  });
  it('cleans the source tag', () => {
    expect(cleanEmail({ email: 'a@b.co', source: '<script>post:x' })?.source).toBe('scriptpost:x');
  });
});
