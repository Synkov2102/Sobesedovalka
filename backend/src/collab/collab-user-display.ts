import type { UserDoc } from '../auth/users.repository';

const MAX_LEN = 80;

/** Человекочитаемое имя для коллаба из профиля (без случайных «ников»). */
export function sanitizeCollabDisplayName(raw: string): string {
  const t = raw.trim().replace(/\s+/g, ' ');
  return t.slice(0, MAX_LEN);
}

export function collabPublicDisplayName(doc: UserDoc | null): string | null {
  if (!doc) {
    return null;
  }
  const name = doc.displayName?.trim();
  if (name) {
    return sanitizeCollabDisplayName(name);
  }
  const email = doc.email?.trim();
  if (email) {
    const at = email.indexOf('@');
    const local =
      at > 0 ? email.slice(0, at).trim() : email.replace(/^@+/, '').trim();
    if (!local) {
      return sanitizeCollabDisplayName(email);
    }
    const spaced = local.replace(/[._]+/g, ' ').trim();
    return sanitizeCollabDisplayName(spaced || local || email);
  }
  const phone = doc.phone?.trim();
  if (phone) {
    return sanitizeCollabDisplayName(phone);
  }
  return null;
}
