import {
  isSafeSandpackPath,
  isStoredFileContentUnchanged,
  parseCollabFilePath,
  parseCollabFileUpdate,
} from './collab-file-guard';

describe('collab-file-guard', () => {
  it('accepts normal sandpack paths', () => {
    expect(parseCollabFilePath('/App.tsx')).toBe('/App.tsx');
    expect(isSafeSandpackPath('/src/App.tsx')).toBe(true);
  });

  it('rejects path traversal and unsafe segments', () => {
    expect(parseCollabFilePath('../App.tsx')).toBeNull();
    expect(parseCollabFilePath('/src/../App.tsx')).toBeNull();
    expect(parseCollabFilePath('/')).toBeNull();
  });

  it('parses valid collab-file body', () => {
    const parsed = parseCollabFileUpdate({
      room: 'room-1',
      path: '/App.tsx',
      content: 'export {}',
      from: 'abcd1234-5678-90ab-cdef',
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.path).toBe('/App.tsx');
      expect(parsed.value.from).toBe('abcd1234-5678-90ab-cdef');
    }
  });

  it('rejects unchanged content helper', () => {
    expect(isStoredFileContentUnchanged('a', 'a')).toBe(true);
    expect(isStoredFileContentUnchanged('a', 'b')).toBe(false);
    expect(isStoredFileContentUnchanged(undefined, 'a')).toBe(false);
  });
});
