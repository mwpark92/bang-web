import { createGame, type GameState } from 'shared';

export interface LobbyPlayer {
  id: string;          // 안정적 플레이어 ID (재접속용)
  name: string;
  socketId: string | null;
  connected: boolean;
}

export interface ChatMessage {
  id: number;
  name: string;
  text: string;
  ts: number;
}

const CHAT_HISTORY_LIMIT = 60;

export interface Room {
  code: string;
  hostId: string;            // 방장 playerId
  players: LobbyPlayer[];     // 좌석 순서 = 배열 순서
  game: GameState | null;
  lastSeed: number;
  chat: ChatMessage[];
  chatSeq: number;
  testMode: boolean;            // 혼자 핫시트 테스트 모드
  controllerSocketId: string | null; // 테스트 모드에서 모든 좌석을 조작하는 소켓
}

export interface LobbyPlayerView {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
}

export interface RoomView {
  code: string;
  hostId: string;
  started: boolean;
  testMode: boolean;
  players: LobbyPlayerView[];
  you: string;
}

const rooms = new Map<string, Room>();

function randomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function createRoom(name: string, socketId: string): { room: Room; playerId: string } {
  let code = randomCode();
  while (rooms.has(code)) code = randomCode();
  const playerId = randomId();
  const room: Room = {
    code,
    hostId: playerId,
    players: [{ id: playerId, name: name.trim() || '플레이어', socketId, connected: true }],
    game: null,
    lastSeed: Date.now(),
    chat: [],
    chatSeq: 0,
    testMode: false,
    controllerSocketId: null,
  };
  rooms.set(code, room);
  return { room, playerId };
}

/** 혼자 플레이 테스트 방: 더미 플레이어로 채우고 즉시 게임 시작 */
export function createTestRoom(
  name: string,
  count: number,
  socketId: string,
): { room: Room; playerId: string } {
  const n = Math.min(7, Math.max(4, Math.floor(count) || 4));
  let code = randomCode();
  while (rooms.has(code)) code = randomCode();
  const playerId = randomId();
  const players: LobbyPlayer[] = [
    { id: playerId, name: name.trim() || '나', socketId, connected: true },
  ];
  for (let i = 1; i < n; i++) {
    players.push({ id: randomId(), name: `봇${i}`, socketId: null, connected: false });
  }
  const room: Room = {
    code,
    hostId: playerId,
    players,
    game: null,
    lastSeed: Date.now(),
    chat: [],
    chatSeq: 0,
    testMode: true,
    controllerSocketId: socketId,
  };
  room.game = createGame(players.map((p) => ({ id: p.id, name: p.name })), room.lastSeed);
  rooms.set(code, room);
  return { room, playerId };
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
}

export function joinRoom(
  code: string,
  name: string,
  socketId: string,
): { room: Room; playerId: string } | { error: string } {
  const room = getRoom(code);
  if (!room) return { error: '존재하지 않는 방 코드입니다.' };
  if (room.game) return { error: '이미 게임이 시작된 방입니다.' };
  if (room.players.length >= 7) return { error: '방이 가득 찼습니다. (최대 7명)' };
  const playerId = randomId();
  room.players.push({ id: playerId, name: name.trim() || '플레이어', socketId, connected: true });
  return { room, playerId };
}

/** 재접속: 기존 playerId로 소켓 연결 복구 */
export function rejoin(
  code: string,
  playerId: string,
  socketId: string,
): { room: Room } | { error: string } {
  const room = getRoom(code);
  if (!room) return { error: '존재하지 않는 방입니다.' };
  const p = room.players.find((pl) => pl.id === playerId);
  if (!p) return { error: '이 방의 참가자가 아닙니다.' };
  p.socketId = socketId;
  p.connected = true;
  return { room };
}

export function startGame(room: Room, hostPlayerId: string): { error?: string } {
  if (room.hostId !== hostPlayerId) return { error: '방장만 게임을 시작할 수 있습니다.' };
  if (room.game) return { error: '이미 게임이 진행 중입니다.' };
  if (room.players.length < 4) return { error: '최소 4명이 필요합니다.' };
  if (room.players.length > 7) return { error: '최대 7명까지 가능합니다.' };
  room.lastSeed = Date.now();
  room.game = createGame(
    room.players.map((p) => ({ id: p.id, name: p.name })),
    room.lastSeed,
  );
  return {};
}

export function restartGame(room: Room, hostPlayerId: string): { error?: string } {
  if (room.hostId !== hostPlayerId) return { error: '방장만 다시 시작할 수 있습니다.' };
  if (room.players.length < 4 || room.players.length > 7) {
    return { error: '플레이어 수는 4~7명이어야 합니다.' };
  }
  room.lastSeed = Date.now();
  room.game = createGame(
    room.players.map((p) => ({ id: p.id, name: p.name })),
    room.lastSeed,
  );
  return {};
}

/** 소켓 연결 해제 시: 해당 소켓을 가진 플레이어를 끊김 처리 */
export function handleDisconnect(socketId: string): Room[] {
  const affected: Room[] = [];
  for (const room of rooms.values()) {
    const p = room.players.find((pl) => pl.socketId === socketId);
    if (!p) continue;
    p.connected = false;
    p.socketId = null;
    affected.push(room);
    // 게임 시작 전이고 아무도 남지 않으면 방 제거
    if (!room.game && room.players.every((pl) => !pl.connected)) {
      rooms.delete(room.code);
    } else if (!room.game) {
      // 로비 단계에서 끊긴 플레이어는 제거
      room.players = room.players.filter((pl) => pl.connected);
      if (room.players.length > 0 && !room.players.some((pl) => pl.id === room.hostId)) {
        room.hostId = room.players[0].id;
      }
      if (room.players.length === 0) rooms.delete(room.code);
    }
  }
  return affected;
}

/** 방 채팅에 메시지를 추가하고 생성된 메시지를 반환 (없으면 null) */
export function addChat(room: Room, name: string, rawText: string): ChatMessage | null {
  const text = rawText.trim().slice(0, 200);
  if (!text) return null;
  room.chatSeq += 1;
  const msg: ChatMessage = { id: room.chatSeq, name, text, ts: Date.now() };
  room.chat.push(msg);
  if (room.chat.length > CHAT_HISTORY_LIMIT) room.chat.shift();
  return msg;
}

export function roomView(room: Room, you: string): RoomView {
  return {
    code: room.code,
    hostId: room.hostId,
    started: !!room.game,
    testMode: room.testMode,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
      isHost: p.id === room.hostId,
    })),
    you,
  };
}
