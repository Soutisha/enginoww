import { MarketingService } from '../marketing.service';

describe('MarketingService output safety and brand checks', () => {
  const service = new MarketingService() as any;

  it('normalizes a banner draft even when the model omits its banner block', () => {
    const result = service.normalizeResult(
      { title: 'Winter collection', summary: 'A fresh collection.', variants: [{ label: 'A', content: 'Discover the new collection.' }] },
      { type: 'banner', objective: 'Promote new collection', audience: 'Customers' },
    );
    expect(result.banner.headline).toBe('Winter collection');
    expect(result.banner.cta).toBe('Learn more');
  });

  it('normalizes a campaign draft with a safe default channel', () => {
    const result = service.normalizeResult(
      { title: 'New season', summary: 'Campaign summary', variants: [{ label: 'A', content: 'See what is new.' }] },
      { type: 'campaign', objective: 'Drive visits', audience: 'Existing customers' },
    );
    expect(result.campaign.name).toBe('New season');
    expect(result.campaign.channel).toBe('WHATSAPP');
  });

  it('flags disallowed brand terms in generated copy', () => {
    const result = { variants: [{ label: 'A', content: 'Guaranteed results for every buyer.' }] };
    const check = service.checkBrandConsistency(result, {
      avoidTerms: ['guaranteed results'], preferredTerms: ['customer-first'],
      primaryColor: '#2563eb', secondaryColor: '#0f172a',
    });
    expect(check.passed).toBe(false);
    expect(check.avoidMatches).toContain('guaranteed results');
    expect(check.missingPreferred).toContain('customer-first');
  });

  it('uses only valid six-digit brand colours', () => {
    expect(service.safeColor('#12abef', '#000000')).toBe('#12abef');
    expect(service.safeColor('red;url(x)', '#000000')).toBe('#000000');
  });

  it('rejects malformed provider JSON rather than saving arbitrary text', () => {
    expect(() => service.parseJson('not JSON')).toThrow();
  });

  it('bounds generated variant text and ignores non-string hashtags', () => {
    const result = service.normalizeResult({
      title: 'Test',
      variants: [{ label: '  Short  ', content: ' x '.repeat(4000), hashtags: [' #safe ', 4] }],
    }, { type: 'promotional_copy' });
    expect(result.variants[0].label).toBe('Short');
    expect(result.variants[0].content.length).toBeLessThanOrEqual(5000);
    expect(result.variants[0].hashtags).toEqual(['#safe']);
  });
});
