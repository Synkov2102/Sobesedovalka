import { normalizeSandpackFilePath } from './sandpack-paths';

export const MAX_COLLAB_FILE_BYTES = 600_000;
export const MAX_COLLAB_PATH_LEN = 256;
const MAX_COLLAB_CLIENT_ID_LEN = 64;
const CLIENT_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;

export type CollabFileRejectReason =
  | 'empty-room'
  | 'empty-path'
  | 'unsafe-path'
  | 'path-too-long'
  | 'invalid-from'
  | 'content-too-large'
  | 'not-in-room'
  | 'from-mismatch'
  | 'unchanged';

export type ParsedCollabFileUpdate = {
  room: string;
  path: string;
  content: string;
  from: string;
};

export function normalizeCollabClientId(raw: string): string | null {
  const id = raw.trim();
  if (!id || id.length > MAX_COLLAB_CLIENT_ID_LEN) {
    return null;
  }
  if (!CLIENT_ID_RE.test(id)) {
    return null;
  }
  return id;
}

export function isSafeSandpackPath(normalized: string): boolean {
  if (!normalized.startsWith('/')) {
    return false;
  }
  if (normalized.length > MAX_COLLAB_PATH_LEN) {
    return false;
  }
  if (normalized.includes('\0') || normalized.includes('..')) {
    return false;
  }
  const inner = normalized.slice(1);
  if (!inner || inner.includes('//')) {
    return false;
  }
  const segments = inner.split('/');
  return segments.every(
    (segment) => segment.length > 0 && segment !== '.' && segment !== '..',
  );
}

export function parseCollabFilePath(raw: string): string | null {
  const path = normalizeSandpackFilePath(raw);
  if (!path || !isSafeSandpackPath(path)) {
    return null;
  }
  return path;
}

export function isCollabFileContentValid(content: string): boolean {
  return content.length <= MAX_COLLAB_FILE_BYTES;
}

export function parseCollabFileUpdate(body: {
  room?: string;
  path?: string;
  content?: string;
  from?: string;
}): { ok: true; value: ParsedCollabFileUpdate } | { ok: false; reason: CollabFileRejectReason } {
  const room = typeof body.room === 'string' ? body.room.trim() : '';
  if (!room) {
    return { ok: false, reason: 'empty-room' };
  }

  const path =
    typeof body.path === 'string' ? parseCollabFilePath(body.path) : null;
  if (!path) {
    const reason =
      typeof body.path === 'string' && body.path.trim()
        ? 'unsafe-path'
        : 'empty-path';
    return { ok: false, reason };
  }

  const content = typeof body.content === 'string' ? body.content : '';
  if (!isCollabFileContentValid(content)) {
    return { ok: false, reason: 'content-too-large' };
  }

  const from =
    typeof body.from === 'string' ? normalizeCollabClientId(body.from) : null;
  if (!from) {
    return { ok: false, reason: 'invalid-from' };
  }

  return { ok: true, value: { room, path, content, from } };
}

export function isStoredFileContentUnchanged(
  stored: string | undefined,
  incoming: string,
): boolean {
  return stored !== undefined && stored === incoming;
}
