import * as Y from 'yjs';
import { CollabGateway } from './collab.gateway';

type GatewayInternals = CollabGateway & {
  socketMeta: Map<string, { room: string; clientId: string }>;
  roomYDocs: Map<string, Y.Doc>;
  roomFiles: Map<string, Map<string, string>>;
};

describe('CollabGateway legacy editor sync', () => {
  it('rejects full-file collab-file updates once Yjs is active for the room', () => {
    const gateway = new CollabGateway({} as never, {} as never, {} as never);
    const internals = gateway as unknown as GatewayInternals;
    const room = 'room-1';
    const clientId = 'client-1';
    const socket = { id: 'socket-1' };
    const emit = jest.fn();

    (gateway as never as { server: { to: jest.Mock } }).server = {
      to: jest.fn(() => ({ emit })),
    };
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
    expect(gateway.server.to).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });
});
