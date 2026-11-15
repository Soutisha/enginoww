import { chunkMarkdown } from './chunker';

describe('chunkMarkdown', () => {
  it('returns no chunks for empty content', () => {
    expect(chunkMarkdown('  \n\n')).toEqual([]);
  });

  it('keeps paragraph boundaries and accurate one-based line ranges', () => {
    const chunks = chunkMarkdown('# Heading\nFirst paragraph.\n\nSecond paragraph.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({
      text: '# Heading\nFirst paragraph.\n\nSecond paragraph.',
      startLine: 1,
      endLine: 4,
    });
  });

  it('splits oversized paragraphs without losing line content', () => {
    const lines = ['a'.repeat(450), 'b'.repeat(450), 'c'.repeat(450)];
    const chunks = chunkMarkdown(lines.join('\n'));
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((chunk) => chunk.text).join('\n')).toBe(lines.join('\n'));
    expect(chunks[0].startLine).toBe(1);
    expect(chunks[chunks.length - 1].endLine).toBe(3);
  });
});
