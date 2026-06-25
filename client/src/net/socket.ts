import { io, type Socket } from 'socket.io-client';
import type { ClientView } from 'shared';
import type { ChatMessage, RoomView } from './types.js';

export interface AppState {
  connected: boolean;
  room: RoomView | null;
  view: ClientView | null;
  error: string | null;
  chat: ChatMessage[];
}

type Listener = () => void;

const STORAGE_KEY = 'bang_session';

interface Saved {
  roomCode: string;
  playerId: string;
  name: string;
}

function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function save(s: Saved): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function clearSaved(): void {
  localStorage.removeItem(STORAGE_KEY);
}

class Store {
  state: AppState = { connected: false, room: null, view: null, error: null, chat: [] };
  private listeners = new Set<Listener>();
  socket: Socket;

  constructor() {
    const url = import.meta.env.DEV ? 'http://localhost:3001' : undefined;
    this.socket = url ? io(url) : io();
    this.wire();
  }

  private wire(): void {
    this.socket.on('connect', () => {
      this.set({ connected: true });
      const saved = loadSaved();
      if (saved) {
        this.socket.emit('rejoin', { roomCode: saved.roomCode, playerId: saved.playerId }, (r: any) => {
          if (!r?.ok) clearSaved();
        });
      }
    });
    this.socket.on('disconnect', () => this.set({ connected: false }));
    this.socket.on('room', (room: RoomView) => this.set({ room }));
    this.socket.on('state', (view: ClientView) => this.set({ view }));
    this.socket.on('error', (msg: string) => this.set({ error: msg }));
    this.socket.on('chatHistory', (chat: ChatMessage[]) => this.set({ chat }));
    this.socket.on('chat', (msg: ChatMessage) => {
      const next = [...this.state.chat, msg];
      if (next.length > 80) next.shift();
      this.set({ chat: next });
    });
  }

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getState = (): AppState => this.state;

  private set(partial: Partial<AppState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((l) => l());
  }

  setError(msg: string | null): void {
    this.set({ error: msg });
  }

  createRoom(name: string): void {
    this.socket.emit('createRoom', { name }, (r: any) => {
      if (r?.ok) {
        save({ roomCode: r.roomCode, playerId: r.playerId, name });
      } else {
        this.setError(r?.error ?? '방 생성 실패');
      }
    });
  }

  joinRoom(roomCode: string, name: string): void {
    this.socket.emit('joinRoom', { roomCode: roomCode.toUpperCase(), name }, (r: any) => {
      if (r?.ok) {
        save({ roomCode: r.roomCode, playerId: r.playerId, name });
      } else {
        this.setError(r?.error ?? '입장 실패');
      }
    });
  }

  createTestRoom(name: string, count: number, password: string): void {
    this.socket.emit('createTestRoom', { name, count, password }, (r: any) => {
      if (r?.ok) {
        save({ roomCode: r.roomCode, playerId: r.playerId, name });
      } else {
        this.setError(r?.error ?? '테스트 방 생성 실패');
      }
    });
  }

  startGame(): void {
    this.socket.emit('startGame', {}, (r: any) => {
      if (!r?.ok) this.setError(r?.error ?? '시작 실패');
    });
  }

  restart(): void {
    this.socket.emit('restart', {}, (r: any) => {
      if (!r?.ok) this.setError(r?.error ?? '재시작 실패');
    });
  }

  leave(): void {
    clearSaved();
    this.set({ room: null, view: null, chat: [] });
    // 간단히 새로고침으로 소켓 재연결
    this.socket.disconnect();
    this.socket.connect();
  }

  send(action: any): void {
    this.socket.emit('action', action);
  }

  sendChat(text: string): void {
    const t = text.trim();
    if (!t) return;
    this.socket.emit('chat', { text: t });
  }
}

export const store = new Store();
