import * as Y from 'yjs';
import { CollabGateway } from './collab.gateway';

/** Private maps accessed via cast — do not intersect with CollabGateway (private fields → never). */
type GatewayInternals = {
  socketMeta: Map<string, { room: string; clientId: string }>;
  roomPeers: Map<string, Map<string, { displayName: string }>>;
  roomYDocs: Map<string, Y.Doc>;
  roomFiles: Map<string, Map<string, string>>;
};

describe('CollabGateway legacy editor sync', () => {
  function createGateway() {
    const mongoRepo = {
      deleteFile: jest.fn().mockResolvedValue(undefined),
      deletePeer: jest.fn().mockResolvedValue(undefined),
      replaceRoomFiles: jest.fn().mockResolvedValue(undefined),
      replaceRoomFolders: jest.fn().mockResolvedValue(undefined),
    };
    const gateway = new CollabGateway(
      mongoRepo as never,
      {} as never,
      {} as never,
    );
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));

    (gateway as never as { server: { to: jest.Mock } }).server = { to };

    return {
      gateway,
      internals: gateway as unknown as GatewayInternals,
      mongoRepo,
      emit,
      to,
    };
  }

  it('rejects full-file collab-file updates once Yjs is active for the room', () => {
    const { gateway, internals, emit, to } = createGateway();
    const room = 'room-1';
    const clientId = 'client-1';
    const socket = { id: 'socket-1' };

    internals.socketMeta.set(socket.id, { room, clientId });
    internals.roomYDocs.set(room, new Y.Doc());

    gateway.handleFile(
      {
        room,
        path: '/App.tsx',
        content: 'stale text',
        from: clientId,
      },
      socket as never,
    );

    expect(internals.roomFiles.has(room)).toBe(false);
    expect(to).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('rejects legacy remove updates once Yjs is active for the room', () => {
    const { gateway, internals, mongoRepo, emit, to } = createGateway();
    const room = 'room-1';
    const clientId = 'client-1';
    const socket = { id: 'socket-1' };

    internals.socketMeta.set(socket.id, { room, clientId });
    internals.roomFiles.set(room, new Map([['/App.tsx', 'text']]));
    internals.roomYDocs.set(room, new Y.Doc());

    gateway.handleRemove(
      {
        room,
        path: '/App.tsx',
        from: clientId,
      },
      socket as never,
    );

    expect(mongoRepo.deleteFile).not.toHaveBeenCalled();
    expect(internals.roomFiles.get(room)?.has('/App.tsx')).toBe(true);
    expect(to).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('rejects legacy folder sync once Yjs is active for the room', () => {
    const { gateway, internals, mongoRepo, emit, to } = createGateway();
    const room = 'room-1';

    internals.roomYDocs.set(room, new Y.Doc());

    gateway.handleFoldersSync({
      room,
      folders: ['/src'],
    });

    expect(mongoRepo.replaceRoomFolders).not.toHaveBeenCalled();
    expect(to).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('flushes pending Yjs state before destroying an empty room', () => {
    const { gateway, internals, mongoRepo } = createGateway();
    const room = 'room-1';
    const clientId = 'client-1';
    const socket = { id: 'socket-1' };
    const doc = new Y.Doc();

    doc.transact(() => {
      doc.getMap<boolean>('files').set('/App.tsx', true);
      doc.getText('file:/App.tsx').insert(0, 'fresh text');
    });
    internals.socketMeta.set(socket.id, { room, clientId });
    internals.roomPeers.set(
      room,
      new Map([[clientId, { displayName: 'User' }]]),
    );
    internals.roomYDocs.set(room, doc);

    gateway.handleDisconnect(socket as never);

    expect(mongoRepo.replaceRoomFiles).toHaveBeenCalledWith(room, {
      '/App.tsx': 'fresh text',
    });
    expect(mongoRepo.replaceRoomFolders).toHaveBeenCalledWith(room, []);
    expect(internals.roomYDocs.has(room)).toBe(false);
  });
});
