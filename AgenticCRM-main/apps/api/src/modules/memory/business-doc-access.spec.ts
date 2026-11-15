import { canAccessBusinessDocument } from './business-doc-access';

describe('canAccessBusinessDocument', () => {
  const base = { ownerUserId: 'owner', allowedUserIds: [] as string[] };

  it('allows every tenant member to read COMPANY documents', () => {
    expect(canAccessBusinessDocument({ ...base, visibility: 'COMPANY' }, 'member')).toBe(true);
    expect(canAccessBusinessDocument({ ...base, visibility: 'COMPANY' })).toBe(true);
  });

  it('restricts PRIVATE documents to the owner and administrators', () => {
    const document = { ...base, visibility: 'PRIVATE' };
    expect(canAccessBusinessDocument(document, 'owner')).toBe(true);
    expect(canAccessBusinessDocument(document, 'other')).toBe(false);
    expect(canAccessBusinessDocument(document)).toBe(false);
    expect(canAccessBusinessDocument(document, 'other', true)).toBe(true);
  });

  it('restricts RESTRICTED documents to owner, shared users, and administrators', () => {
    const document = { ...base, visibility: 'RESTRICTED', allowedUserIds: ['shared'] };
    expect(canAccessBusinessDocument(document, 'owner')).toBe(true);
    expect(canAccessBusinessDocument(document, 'shared')).toBe(true);
    expect(canAccessBusinessDocument(document, 'other')).toBe(false);
    expect(canAccessBusinessDocument(document, 'admin', true)).toBe(true);
  });
});
