import { useState } from 'react';
import { CARD_DEFS, CHARACTERS, type CardName, type ClientView, type PublicPlayer } from 'shared';
import { Card } from '../../components/Card.js';
import { ROLE_GOAL, ROLE_LABEL, winnerLabel } from '../../i18n/ko.js';
import { store } from '../../net/useStore.js';
import type { RoomView } from '../../net/types.js';
import { DrawPhasePrompt } from './DrawPhasePrompt.js';
import { PlayerSeat } from './PlayerSeat.js';
import { ResponsePrompt } from './ResponsePrompt.js';
import { CARD_PICK_CARDS, TARGETED_CARDS, validTargets } from './targeting.js';

interface Props {
  room: RoomView;
  view: ClientView;
}

export function GameTable({ room, view }: Props) {
  const me = view.players.find((p) => p.isYou)!;
  const others = view.players
    .filter((p) => !p.isYou)
    .sort((a, b) => a.seat - b.seat);

  // 카드 선택/타게팅 상태
  const [selected, setSelected] = useState<{ cardId: string; name: CardName } | null>(null);
  const [pickFor, setPickFor] = useState<{ cardId: string; targetId: string; target: PublicPlayer } | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [sidMode, setSidMode] = useState(false);
  const [sidPicks, setSidPicks] = useState<string[]>([]);

  const myTurn = view.yourTurn;
  const mustDiscard = myTurn && me.hand !== null && me.hand.length > me.health;
  const targets = selected ? validTargets(view, selected.name) : new Set<string>();

  // 시드 케첨 능력 사용 가능 여부
  const canSid =
    me.character === 'sidKetchum' &&
    me.health < me.maxHealth &&
    (me.hand?.length ?? 0) >= 2 &&
    !view.pending;

  const reset = () => {
    setSelected(null);
    setPickFor(null);
  };

  const onHandCard = (cardId: string, name: CardName) => {
    // 시드 케첨: 버릴 카드 2장 선택
    if (sidMode) {
      setSidPicks((prev) => {
        const next = prev.includes(cardId) ? prev.filter((x) => x !== cardId) : [...prev, cardId];
        if (next.length === 2) {
          store.send({ type: 'ability', cardIds: next });
          setSidMode(false);
          return [];
        }
        return next;
      });
      return;
    }
    if (view.pending) return;
    if (mustDiscard) {
      store.send({ type: 'discard', cardId });
      return;
    }
    if (!myTurn) return;
    // 칼라미티 자넷: 빗나감!을 뱅!처럼 사용
    const effName: CardName = name === 'missed' && me.character === 'calamityJanet' ? 'bang' : name;
    if (TARGETED_CARDS.has(effName)) {
      setSelected({ cardId, name: effName });
    } else {
      store.send({ type: 'playCard', cardId });
      reset();
    }
  };

  const onTargetPlayer = (target: PublicPlayer) => {
    if (!selected) return;
    if (CARD_PICK_CARDS.has(selected.name) && target.equipment.length > 0) {
      // 어떤 카드를 가져갈지 선택
      setPickFor({ cardId: selected.cardId, targetId: target.id, target });
      return;
    }
    store.send({ type: 'playCard', cardId: selected.cardId, targetId: target.id });
    reset();
  };

  const sendPick = (targetCardId?: string) => {
    if (!pickFor) return;
    store.send({ type: 'playCard', cardId: pickFor.cardId, targetId: pickFor.targetId, targetCardId });
    reset();
  };

  const isHost = room.hostId === room.you;

  return (
    <div className="game">
      {/* 상단 바 */}
      <div className="topbar">
        <span className="room-pill">방 {room.code}</span>
        <span className="turn-pill">
          {view.phase === 'over'
            ? '게임 종료'
            : myTurn
              ? '내 턴'
              : `${view.players.find((p) => p.seat === view.turnSeat)?.name ?? ''}의 턴`}
        </span>
        <button className="btn tiny" onClick={() => setShowLog((v) => !v)}>
          기록
        </button>
      </div>

      {/* 상대 좌석 */}
      <div className="opponents">
        {others.map((p) => (
          <PlayerSeat
            key={p.id}
            player={p}
            isTurn={p.seat === view.turnSeat}
            targetable={!!selected && targets.has(p.id)}
            onTarget={() => onTargetPlayer(p)}
          />
        ))}
      </div>

      {/* 중앙: 덱 / 버린 더미 */}
      <div className="center">
        <div className="pile deck">
          <div className="card back" />
          <span className="pile-count">덱 {view.deckCount}</span>
        </div>
        <div className="pile discard">
          {view.discardTop ? (
            <Card card={view.discardTop} disabled />
          ) : (
            <div className="card empty-pile">비어있음</div>
          )}
          <span className="pile-count">버린 더미 {view.discardCount}</span>
        </div>
      </div>

      {/* 타게팅 안내 바 */}
      {selected && (
        <div className="targeting-bar">
          <span>
            {CARD_DEFS[selected.name].label} — 대상을 선택하세요
            {targets.size === 0 ? ' (가능한 대상 없음)' : ''}
          </span>
          <button className="btn tiny ghost" onClick={reset}>
            취소
          </button>
        </div>
      )}

      {/* 내 정보 + 손패 */}
      <div className="myarea">
        <div className="myinfo">
          <div className="myrole">
            <span className={`role-tag role-${me.role}`}>{me.role ? ROLE_LABEL[me.role] : '?'}</span>
            <span className="health">
              {'❤'.repeat(Math.max(0, me.health))}
              <span className="health-lost">{'♡'.repeat(Math.max(0, me.maxHealth - me.health))}</span>
            </span>
          </div>
          <div className="mychar" title={CHARACTERS[me.character].ability}>
            🎭 <b>{CHARACTERS[me.character].name}</b> — {CHARACTERS[me.character].ability}
          </div>
          <div className="mygoal">{me.role ? ROLE_GOAL[me.role] : ''}</div>
          {me.equipment.length > 0 && (
            <div className="my-equipment">
              {me.equipment.map((c) => (
                <Card key={c.id} card={c} small disabled />
              ))}
            </div>
          )}
        </div>

        {sidMode && (
          <div className="targeting-bar">
            <span>시드 케첨 — 버릴 카드 2장을 고르세요 ({sidPicks.length}/2)</span>
            <button className="btn tiny ghost" onClick={() => { setSidMode(false); setSidPicks([]); }}>
              취소
            </button>
          </div>
        )}

        <div className="hand-row">
          {(me.hand ?? []).map((c) => (
            <Card
              key={c.id}
              card={c}
              selected={selected?.cardId === c.id || sidPicks.includes(c.id)}
              disabled={!myTurn && !mustDiscard && !sidMode}
              onClick={() => onHandCard(c.id, c.name)}
            />
          ))}
          {(me.hand ?? []).length === 0 && <span className="hint">손패가 없습니다.</span>}
        </div>

        <div className="actions">
          {mustDiscard && <span className="warn">손패 한도 초과! {me.hand!.length - me.health}장을 버리세요.</span>}
          {canSid && !sidMode && (
            <button className="btn" onClick={() => { setSidMode(true); setSidPicks([]); }}>
              능력: 2장 버리고 회복
            </button>
          )}
          {myTurn && !mustDiscard && !sidMode && (
            <button className="btn primary" onClick={() => store.send({ type: 'endTurn' })}>
              턴 종료
            </button>
          )}
        </div>
      </div>

      {/* 반응 프롬프트 */}
      <ResponsePrompt view={view} />

      {/* 뽑기 단계 프롬프트 (킷/제시/페드로) */}
      <DrawPhasePrompt view={view} />

      {/* 약탈/캣발루 카드 선택 */}
      {pickFor && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>{pickFor.target.name}의 카드 선택</h3>
            <div className="prompt-cards">
              {pickFor.target.handCount > 0 && (
                <button className="btn" onClick={() => sendPick(undefined)}>
                  손패에서 무작위 ({pickFor.target.handCount}장)
                </button>
              )}
              {pickFor.target.equipment.map((c) => (
                <Card key={c.id} card={c} onClick={() => sendPick(c.id)} />
              ))}
            </div>
            <button className="btn ghost" onClick={() => setPickFor(null)}>
              취소
            </button>
          </div>
        </div>
      )}

      {/* 게임 기록 */}
      {showLog && (
        <div className="log-panel" onClick={() => setShowLog(false)}>
          <div className="log-inner" onClick={(e) => e.stopPropagation()}>
            <h3>게임 기록</h3>
            <div className="log-list">
              {[...view.log].reverse().map((l) => (
                <div key={l.id} className="log-line">
                  {l.text}
                </div>
              ))}
            </div>
            <button className="btn ghost" onClick={() => setShowLog(false)}>
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 최근 로그 한 줄 */}
      {view.log.length > 0 && (
        <div className="ticker">{view.log[view.log.length - 1].text}</div>
      )}

      {/* 승리 오버레이 */}
      {view.phase === 'over' && view.winner && (
        <div className="modal-overlay">
          <div className="modal win">
            <h2>{winnerLabel(view.winner)}</h2>
            <div className="reveal-list">
              {view.players.map((p) => (
                <div key={p.id} className="reveal-row">
                  <span>{p.name}</span>
                  <span className={`role-tag role-${p.role}`}>{p.role ? ROLE_LABEL[p.role] : '?'}</span>
                  <span>{p.alive ? '생존' : '사망'}</span>
                </div>
              ))}
            </div>
            {isHost ? (
              <button className="btn primary" onClick={() => store.restart()}>
                다시 시작
              </button>
            ) : (
              <p className="hint">방장이 다시 시작하기를 기다리는 중…</p>
            )}
            <button className="btn ghost" onClick={() => store.leave()}>
              나가기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
