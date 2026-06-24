import { useState } from 'react';
import { store } from '../net/useStore.js';

export function Home() {
  const [name, setName] = useState(() => localStorage.getItem('bang_name') ?? '');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'join'>('menu');

  const remember = (n: string) => {
    setName(n);
    localStorage.setItem('bang_name', n);
  };

  const canPlay = name.trim().length > 0;

  return (
    <div className="home">
      <div className="home-card">
        <h1 className="logo">BANG!</h1>
        <p className="subtitle">서부 총잡이 카드게임 · 온라인</p>

        <label className="field">
          <span>닉네임</span>
          <input
            value={name}
            maxLength={12}
            placeholder="이름을 입력하세요"
            onChange={(e) => remember(e.target.value)}
          />
        </label>

        {mode === 'menu' ? (
          <div className="btn-col">
            <button className="btn primary" disabled={!canPlay} onClick={() => store.createRoom(name.trim())}>
              방 만들기
            </button>
            <button className="btn" disabled={!canPlay} onClick={() => setMode('join')}>
              코드로 입장
            </button>
          </div>
        ) : (
          <div className="btn-col">
            <label className="field">
              <span>방 코드</span>
              <input
                value={code}
                maxLength={4}
                placeholder="ABCD"
                style={{ textTransform: 'uppercase', letterSpacing: '4px', textAlign: 'center', fontSize: '1.4rem' }}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            </label>
            <button
              className="btn primary"
              disabled={!canPlay || code.trim().length !== 4}
              onClick={() => store.joinRoom(code.trim(), name.trim())}
            >
              입장하기
            </button>
            <button className="btn ghost" onClick={() => setMode('menu')}>
              뒤로
            </button>
          </div>
        )}

        <p className="hint">4~7명이 모이면 방장이 게임을 시작합니다.</p>
      </div>
    </div>
  );
}
