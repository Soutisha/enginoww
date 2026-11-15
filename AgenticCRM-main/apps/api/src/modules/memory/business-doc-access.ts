/** Centralized access policy for indexed business documents. */
export interface BusinessDocumentAccess {
  visibility: string;
  ownerUserId: string | null;
  allowedUserIds: string[];
}

/**
 * COMPANY documents are available to all members of the tenant. PRIVATE
 * documents are available only to their owner and administrators. RESTRICTED
 * documents are available to their owner, explicitly shared users, and admins.
 * Tenant scoping must still be applied by the database query before this check.
 */
export function canAccessBusinessDocument(
  document: BusinessDocumentAccess,
  userId?: string,
  canViewAll = false,
): boolean {
  if (document.visibility === 'COMPANY' || canViewAll) return true;
  if (!userId) return false;
  return document.ownerUserId === userId || document.allowedUserIds.includes(userId);
}
