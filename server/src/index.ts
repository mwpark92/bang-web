import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server, type Socket } from 'socket.io';
import { activePlayerId, applyAction, redact, type GameAction } from 'shared';
import {
  addChat,
  createRoom,
  createTestRoom,
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
// 테스트(혼자 플레이) 모드 접근 비밀번호 — 환경변수로 변경 가능, 기본 4321
const TEST_MODE_PASSWORD = process.env.TEST_MODE_PASSWORD || '4321';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

// 소켓별 현재 소속 (방/플레이어)
const socketInfo = new Map<string, { code: string; playerId: string }>();

// ===== 브로드캐스트 =====

function broadcastRoom(room: Room): void {
  // 테스트 모드: 단일 컨트롤러에게 "지금 행동할 플레이어" 시점의 뷰를 전송
  if (room.testMode) {
    const sock = room.controllerSocketId && io.sockets.sockets.get(room.controllerSocketId);
    if (!sock) return;
    sock.emit('room', roomView(room, room.hostId));
    if (room.game) sock.emit('state', redact(room.game, activePlayerId(room.game)));
    return;
  }
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
    socket.emit('chatHistory', room.chat);
  });

  socket.on('createTestRoom', ({ name, count, password }: { name: string; count: number; password?: string }, cb?: (r: any) => void) => {
    if ((password ?? '') !== TEST_MODE_PASSWORD) {
      cb?.({ ok: false, error: '비밀번호가 올바르지 않습니다.' });
      return;
    }
    const { room, playerId } = createTestRoom(name, count, socket.id);
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
    socket.emit('chatHistory', res.room.chat);
  });

  socket.on('rejoin', ({ roomCode, playerId }: { roomCode: string; playerId: string }, cb?: (r: any) => void) => {
    const res = rejoin(roomCode, playerId, socket.id);
    if ('error' in res) { cb?.({ ok: false, error: res.error }); return; }
    socketInfo.set(socket.id, { code: res.room.code, playerId });
    if (res.room.testMode) res.room.controllerSocketId = socket.id;
    cb?.({ ok: true, roomCode: res.room.code, playerId });
    broadcastRoom(res.room);
    socket.emit('chatHistory', res.room.chat);
  });

  socket.on('chat', ({ text }: { text: string }) => {
    const info = socketInfo.get(socket.id);
    const room = info && getRoom(info.code);
    if (!info || !room) return;
    const sender = room.players.find((p) => p.id === info.playerId);
    if (!sender) return;
    const msg = addChat(room, sender.name, text ?? '');
    if (!msg) return;
    for (const p of room.players) {
      if (p.connected && p.socketId) io.sockets.sockets.get(p.socketId)?.emit('chat', msg);
    }
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
    // 일반: 소켓 소유자로 강제 / 테스트 모드: 지금 행동할 플레이어로 적용(핫시트)
    const pid = room.testMode ? activePlayerId(room.game) : info.playerId;
    const safeAction = { ...action, playerId: pid } as GameAction;
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
