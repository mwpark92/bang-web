import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server, type Socket } from 'socket.io';
import { applyAction, redact, type GameAction } from 'shared';
import {
  createRoom,
  getRoom,
  handleDisconnect,
  joinRoom,
  rejoin,
  restartGame,
  roomView,
  startGame,
  type Room,
} from './rooms.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

// 소켓별 현재 소속 (방/플레이어)
const socketInfo = new Map<string, { code: string; playerId: string }>();

// ===== 브로드캐스트 =====

function broadcastRoom(room: Room): void {
  for (const p of room.players) {
    if (!p.connected || !p.socketId) continue;
    const sock = io.sockets.sockets.get(p.socketId);
    if (!sock) continue;
    sock.emit('room', roomView(room, p.id));
    if (room.game) {
      sock.emit('state', redact(room.game, p.id));
    }
  }
}

function bind(socket: Socket): void {
  socket.on('createRoom', ({ name }: { name: string }, cb?: (r: any) => void) => {
    const { room, playerId } = createRoom(name, socket.id);
    socketInfo.set(socket.id, { code: room.code, playerId });
    cb?.({ ok: true, roomCode: room.code, playerId });
    broadcastRoom(room);
  });

  socket.on('joinRoom', ({ roomCode, name }: { roomCode: string; name: string }, cb?: (r: any) => void) => {
    const res = joinRoom(roomCode, name, socket.id);
    if ('error' in res) { cb?.({ ok: false, error: res.error }); return; }
    socketInfo.set(socket.id, { code: res.room.code, playerId: res.playerId });
    cb?.({ ok: true, roomCode: res.room.code, playerId: res.playerId });
    broadcastRoom(res.room);
  });

  socket.on('rejoin', ({ roomCode, playerId }: { roomCode: string; playerId: string }, cb?: (r: any) => void) => {
    const res = rejoin(roomCode, playerId, socket.id);
    if ('error' in res) { cb?.({ ok: false, error: res.error }); return; }
    socketInfo.set(socket.id, { code: res.room.code, playerId });
    cb?.({ ok: true, roomCode: res.room.code, playerId });
    broadcastRoom(res.room);
  });

  socket.on('startGame', (_: unknown, cb?: (r: any) => void) => {
    const info = socketInfo.get(socket.id);
    const room = info && getRoom(info.code);
    if (!info || !room) { cb?.({ ok: false, error: '방을 찾을 수 없습니다.' }); return; }
    const res = startGame(room, info.playerId);
    if (res.error) { cb?.({ ok: false, error: res.error }); return; }
    cb?.({ ok: true });
    broadcastRoom(room);
  });

  socket.on('restart', (_: unknown, cb?: (r: any) => void) => {
    const info = socketInfo.get(socket.id);
    const room = info && getRoom(info.code);
    if (!info || !room) { cb?.({ ok: false, error: '방을 찾을 수 없습니다.' }); return; }
    const res = restartGame(room, info.playerId);
    if (res.error) { cb?.({ ok: false, error: res.error }); return; }
    cb?.({ ok: true });
    broadcastRoom(room);
  });

  socket.on('action', (action: GameAction) => {
    const info = socketInfo.get(socket.id);
    const room = info && getRoom(info.code);
    if (!info || !room || !room.game) return;
    // 보안: 액션의 playerId를 소켓 소유자로 강제
    const safeAction = { ...action, playerId: info.playerId } as GameAction;
    applyAction(room.game, safeAction);
    broadcastRoom(room);
  });

  socket.on('disconnect', () => {
    const affected = handleDisconnect(socket.id);
    socketInfo.delete(socket.id);
    for (const room of affected) broadcastRoom(room);
  });
}

io.on('connection', bind);

// ===== 프로덕션: 빌드된 클라이언트 서빙 =====

const clientDist = join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(join(clientDist, 'index.html'), (err) => {
    if (err) res.status(404).send('클라이언트가 빌드되지 않았습니다. npm run build 후 이용하세요.');
  });
});

httpServer.listen(PORT, () => {
  console.log(`Bang! 서버 실행 중: http://localhost:${PORT}`);
});
