import { useState } from 'react';
import { store } from '../net/useStore.js';

export function Home() {
  const [name, setName] = useState(() => localStorage.getItem('bang_name') ?? '');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'join'>('menu');
  const [testCount, setTestCount] = useState(4);

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

        {mode === 'menu' && (
          <div className="test-mode">
            <span className="hint">🧪 혼자 연습 (테스트 모드)</span>
            <div className="test-row">
              <select value={testCount} onChange={(e) => setTestCount(Number(e.target.value))}>
                {[4, 5, 6, 7].map((n) => (
                  <option key={n} value={n}>{n}인</option>
                ))}
              </select>
              <button
                className="btn"
                disabled={!canPlay}
                onClick={() => store.createTestRoom(name.trim(), testCount)}
              >
                혼자 시작
              </button>
            </div>
            <span className="hint">모든 좌석을 번갈아 조작하며 규칙을 익힐 수 있어요.</span>
          </div>
        )}
      </div>
    </div>
  );
}
