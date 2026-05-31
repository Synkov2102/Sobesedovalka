import * as Y from 'yjs';

const FILES = 'files';
const FOLDERS = 'folders';

function fileTextName(path: string): string {
  return `file:${path}`;
}

function seedDoc(files: Record<string, string>): Y.Doc {
  const doc = new Y.Doc();
  doc.transact(() => {
    const filesMap = doc.getMap<boolean>(FILES);
    for (const [path, content] of Object.entries(files)) {
      filesMap.set(path, true);
      doc.getText(fileTextName(path)).insert(0, content);
    }
  });
  return doc;
}

function materialize(doc: Y.Doc): Record<string, string> {
  const out: Record<string, string> = {};
  for (const path of doc.getMap<boolean>(FILES).keys()) {
    out[path] = doc.getText(fileTextName(path)).toJSON();
  }
  return out;
}

describe('collab yjs document model', () => {
  it('converges two concurrent inserts without losing either edit', () => {
    const a = seedDoc({ '/App.tsx': 'hello' });
    const b = new Y.Doc();
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));

    a.getText(fileTextName('/App.tsx')).insert(0, 'A');
    b.getText(fileTextName('/App.tsx')).insert(5, 'B');

    const updateA = Y.encodeStateAsUpdate(a);
    const updateB = Y.encodeStateAsUpdate(b);
    Y.applyUpdate(a, updateB);
    Y.applyUpdate(b, updateA);

    expect(materialize(a)).toEqual(materialize(b));
    expect(materialize(a)['/App.tsx']).toContain('A');
    expect(materialize(a)['/App.tsx']).toContain('B');
  });

  it('hydrates a new client from server state without local editing', () => {
    const server = seedDoc({ '/App.tsx': 'server text' });
    server.getArray<string>(FOLDERS).push(['/src']);

    const client = new Y.Doc();
    Y.applyUpdate(client, Y.encodeStateAsUpdate(server));

    expect(materialize(client)['/App.tsx']).toBe('server text');
    expect(client.getArray<string>(FOLDERS).toArray()).toEqual(['/src']);
  });

  it('syncs file deletion through the shared files map', () => {
    const a = seedDoc({ '/App.tsx': 'x', '/old.ts': 'old' });
    const b = new Y.Doc();
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));

    a.getMap<boolean>(FILES).delete('/old.ts');
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));

    expect(materialize(b)).toEqual({ '/App.tsx': 'x' });
  });
});
