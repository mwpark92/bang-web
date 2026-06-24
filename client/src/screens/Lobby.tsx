import { store } from '../net/useStore.js';
import type { RoomView } from '../net/types.js';

export function Lobby({ room }: { room: RoomView }) {
  const isHost = room.hostId === room.you;
  const count = room.players.length;
  const canStart = isHost && count >= 4 && count <= 7;

  return (
    <div className="lobby">
      <div className="lobby-card">
        <h2>대기실</h2>
        <div className="room-code">
          <span className="label">방 코드</span>
          <span className="code">{room.code}</span>
          <button
            className="btn tiny"
            onClick={() => navigator.clipboard?.writeText(room.code).then(() => store.setError('코드를 복사했습니다.'))}
          >
            복사
          </button>
        </div>

        <div className="player-list">
          {room.players.map((p) => (
            <div key={p.id} className={`player-row ${p.connected ? '' : 'offline'}`}>
              <span className="dot" />
              <span className="pname">{p.name}{p.id === room.you ? ' (나)' : ''}</span>
              {p.isHost && <span className="badge">방장</span>}
            </div>
          ))}
          {Array.from({ length: Math.max(0, 4 - count) }).map((_, i) => (
            <div key={`empty-${i}`} className="player-row empty">빈 자리…</div>
          ))}
        </div>

        <p className="hint">{count}/7명 · 최소 4명 필요</p>

        {isHost ? (
          <button className="btn primary" disabled={!canStart} onClick={() => store.startGame()}>
            게임 시작
          </button>
        ) : (
          <p className="hint">방장이 시작하기를 기다리는 중…</p>
        )}
        <button className="btn ghost" onClick={() => store.leave()}>
          나가기
        </button>
      </div>
    </div>
  );
}
