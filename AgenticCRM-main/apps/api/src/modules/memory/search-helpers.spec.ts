import { buildFtsQuery, extractKeywords, tokenizeQuery } from './search-helpers';

describe('memory search helpers', () => {
  it('tokenizes unicode words and numbers', () => {
    expect(tokenizeQuery('Refund नीति 2026')).toEqual(['Refund', 'नीति', '2026']);
  });

  it('builds a safely quoted AND query', () => {
    expect(buildFtsQuery('Refund Policy')).toBe("'refund' & 'policy'");
    expect(buildFtsQuery('')).toBeNull();
  });

  it('removes conversational stop words and duplicate keywords', () => {
    expect(extractKeywords('Please find refund policy refund')).toEqual(['refund', 'policy']);
  });
});
