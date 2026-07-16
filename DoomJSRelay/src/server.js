import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { WebSocketServer } from 'ws';
import { randomUUID } from 'node:crypto';
import { Room } from './Room.js';
import {
  MessageType,
  PROTOCOL_VERSION,
  encodeMessage,
  decodeMessage,
} from './protocol.js';

const DEFAULT_PORT = Number(process.env.PORT) || 7777;

/**
 * Thin Quantum-style input relay:
 * - lobby / rooms
 * - host setup
 * - collect per-tick inputs from all players
 * - broadcast confirmed input sets
 *
 * Does NOT run Doom simulation.
 */
export function createRelayServer(opts = {}) {
  const port = opts.port ?? DEFAULT_PORT;
  /** @type {Map<string, Room>} */
  const rooms = new Map();
  /** @type {Map<import('ws').WebSocket, { clientId: string, roomId: string|null }>} */
  const sockets = new Map();

  const wss = new WebSocketServer({ port });

  wss.on('connection', (ws) => {
    const clientId = randomUUID();
    sockets.set(ws, { clientId, roomId: null });

    send(ws, {
      type: MessageType.HELLO,
      protocol: PROTOCOL_VERSION,
      clientId,
    });

    ws.on('message', (raw) => {
      try {
        handleMessage(ws, decodeMessage(raw));
      } catch (err) {
        send(ws, {
          type: MessageType.ERROR,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    });

    ws.on('close', () => {
      const meta = sockets.get(ws);
      sockets.delete(ws);
      if (!meta?.roomId) {
        return;
      }
      const room = rooms.get(meta.roomId);
      if (!room) {
        return;
      }
      room.removeClient(meta.clientId);
      if (room.playerCount === 0) {
        rooms.delete(room.id);
      } else {
        room.broadcast(room.snapshot());
      }
    });
  });

  /**
   * @param {import('ws').WebSocket} ws
   * @param {object} msg
   */
  function handleMessage(ws, msg) {
    const meta = sockets.get(ws);
    if (!meta) {
      return;
    }

    switch (msg.type) {
      case MessageType.PING:
        send(ws, { type: MessageType.PONG, t: msg.t });
        break;

      case MessageType.CREATE_ROOM: {
        const roomId = (msg.roomId && String(msg.roomId)) || shortId();
        if (rooms.has(roomId)) {
          throw new Error('Room id taken');
        }
        const room = new Room(roomId, { maxPlayers: msg.maxPlayers ?? 4 });
        const { playerId } = room.addClient(meta.clientId, ws);
        rooms.set(roomId, room);
        meta.roomId = roomId;
        send(ws, {
          type: MessageType.JOIN_ROOM,
          roomId,
          playerId,
          host: true,
        });
        room.broadcast(room.snapshot());
        break;
      }

      case MessageType.JOIN_ROOM: {
        const room = rooms.get(msg.roomId);
        if (!room) {
          throw new Error('Room not found');
        }
        const { playerId } = room.addClient(meta.clientId, ws);
        meta.roomId = room.id;
        send(ws, {
          type: MessageType.JOIN_ROOM,
          roomId: room.id,
          playerId,
          host: meta.clientId === room.hostClientId,
        });
        room.broadcast(room.snapshot());
        break;
      }

      case MessageType.SETUP: {
        const room = requireRoom(meta);
        room.setSetup(meta.clientId, msg.setup ?? {});
        room.broadcast(room.snapshot());
        break;
      }

      case MessageType.READY: {
        const room = requireRoom(meta);
        room.setReady(meta.clientId, msg.ready !== false);
        room.broadcast(room.snapshot());
        break;
      }

      case MessageType.START: {
        const room = requireRoom(meta);
        room.start(meta.clientId);
        room.broadcast({
          type: MessageType.START,
          roomId: room.id,
          setup: room.setup,
          playerMask: room.playerMask,
          seed: room.setup?.seed ?? 1,
        });
        room.broadcast(room.snapshot());
        break;
      }

      case MessageType.INPUT: {
        const room = requireRoom(meta);
        const confirmedList = room.submitInput(meta.clientId, msg.tick, msg.cmd);
        for (const confirmed of confirmedList) {
          room.broadcast(confirmed);
        }
        break;
      }

      case MessageType.LEAVE: {
        const room = requireRoom(meta);
        room.removeClient(meta.clientId);
        meta.roomId = null;
        if (room.playerCount === 0) {
          rooms.delete(room.id);
        } else {
          room.broadcast(room.snapshot());
        }
        break;
      }

      default:
        throw new Error(`Unknown message type: ${msg.type}`);
    }
  }

  /** @param {{ roomId: string|null }} meta */
  function requireRoom(meta) {
    if (!meta.roomId) {
      throw new Error('Not in a room');
    }
    const room = rooms.get(meta.roomId);
    if (!room) {
      throw new Error('Room gone');
    }
    return room;
  }

  return {
    wss,
    rooms,
    port,
    close: () => new Promise((resolve) => wss.close(resolve)),
  };
}

/** @param {import('ws').WebSocket} ws @param {object} msg */
function send(ws, msg) {
  if (ws.readyState === 1) {
    ws.send(encodeMessage(msg));
  }
}

function shortId() {
  return Math.random().toString(36).slice(2, 8);
}

const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  const server = createRelayServer();
  console.log(`[DoomJSRelay] listening on ws://127.0.0.1:${server.port}`);
}
