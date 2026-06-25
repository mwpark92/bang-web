import { useEffect, useState } from 'react';
import { CARD_DEFS, CHARACTERS, type CardName, type ClientView, type PublicPlayer } from 'shared';
import { Card } from '../../components/Card.js';
import { ChatBox } from '../../components/ChatBox.js';
import { ChatToasts } from '../../components/ChatToasts.js';
import { Codex } from '../../components/Codex.js';
import { InspectModal } from '../../components/InspectModal.js';
import { ROLE_GOAL, ROLE_LABEL, winnerLabel } from '../../i18n/ko.js';
import { store, useAppState } from '../../net/useStore.js';
import type { RoomView } from '../../net/types.js';
import { DrawPhasePrompt } from './DrawPhasePrompt.js';
import { PlayerSeat, type InspectPayload } from './PlayerSeat.js';
import { ResponsePrompt } from './ResponsePrompt.js';
import { CARD_PICK_CARDS, TARGETED_CARDS, validTargets, viewDistance } from './targeting.js';

interface Props {
  room: RoomView;
  view: ClientView;
}

export function GameTable({ room, view }: Props) {
  const me = view.players.find((p) => p.isYou)!;
  const n = view.players.length;
  // 나를 기준으로 시계방향 정렬 (내 다음 좌석부터)
  const others = view.players
    .filter((p) => !p.isYou)
    .sort((a, b) => ((a.seat - me.seat + n) % n) - ((b.seat - me.seat + n) % n));

  // 카드 선택/타게팅 상태
  const [selected, setSelected] = useState<{ cardId: string; name: CardName } | null>(null);
  const [pickFor, setPickFor] = useState<{ cardId: string; targetId: string; target: PublicPlayer } | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showCodex, setShowCodex] = useState(false);
  const [inspect, setInspect] = useState<InspectPayload | null>(null);
  const [inspectMode, setInspectMode] = useState(false);
  const [sidMode, setSidMode] = useState(false);
  const [sidPicks, setSidPicks] = useState<string[]>([]);
  const [discardMode, setDiscardMode] = useState(false);

  const activeName = view.players.find((p) => p.seat === view.turnSeat)?.name ?? '';

  const { chat } = useAppState();
  const [readCount, setReadCount] = useState(0);
  const unread = showChat ? 0 : Math.max(0, chat.length - readCount);
  useEffect(() => {
    if (showChat) setReadCount(chat.length);
  }, [showChat, chat.length]);

  const myTurn = view.yourTurn;
  const handCount = me.hand?.length ?? 0;
  const overLimit = myTurn && handCount > me.health; // 턴 종료 시 버려야 하는 상태
  const overBy = Math.max(0, handCount - me.health);
  const targets = selected ? validTargets(view, selected.name) : new Set<string>();

  // 시드 케첨 능력 사용 가능 여부
  const canSid =
    me.character === 'sidKetchum' &&
    me.health < me.maxHealth &&
    handCount >= 2 &&
    !view.pending &&
    !discardMode;

  // 내 턴이 끝나면 보조 모드 정리
  useEffect(() => {
    if (!myTurn) {
      setDiscardMode(false);
      setSidMode(false);
      setSidPicks([]);
      setSelected(null);
    }
  }, [myTurn]);

  const reset = () => {
    setSelected(null);
    setPickFor(null);
  };

  const endTurnClick = () => {
    if (overLimit) {
      setDiscardMode(true);
      store.setError(`손패 한도 초과: ${overBy}장을 버려야 합니다.`);
      return;
    }
    store.send({ type: 'endTurn' });
  };

  const inspectCardByName = (name: CardName) => {
    setInspect({ title: CARD_DEFS[name].label, subtitle: '카드 설명', body: CARD_DEFS[name].desc });
  };

  const onHandCard = (cardId: string, name: CardName) => {
    // 설명 보기 모드: 사용하지 않고 카드 능력만 표시
    if (inspectMode) {
      inspectCardByName(name);
      return;
    }
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
    if (view.pending || !myTurn) return;
    // 버리기 모드: 명시적으로 버릴 때만 버린 더미로
    if (discardMode) {
      store.send({ type: 'discard', cardId });
      return;
    }
    // 사용(play) — 칼라미티 자넷은 빗나감!을 뱅!처럼 사용
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
        <button className="btn tiny" onClick={() => setShowCodex(true)}>
          도움말
        </button>
        <button className="btn tiny" onClick={() => setShowChat((v) => !v)}>
          채팅{unread > 0 ? ` (${unread})` : ''}
        </button>
        <button className="btn tiny" onClick={() => setShowLog((v) => !v)}>
          기록
        </button>
      </div>

      {room.testMode && (
        <div className="test-banner">🧪 테스트 모드 — 지금은 <b>{activeName}</b>의 차례 (모든 좌석을 직접 조작)</div>
      )}

      {/* 상대 좌석 (나 기준 시계방향) */}
      <div className="opponents">
        {others.map((p) => (
          <PlayerSeat
            key={p.id}
            player={p}
            isTurn={p.seat === view.turnSeat}
            targetable={!!selected && targets.has(p.id)}
            posLabel={p.alive ? `거리 ${viewDistance(view.players, me, p)}` : undefined}
            onTarget={() => onTargetPlayer(p)}
            onInspect={setInspect}
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
      <div className={`myarea ${myTurn ? 'my-turn' : ''}`}>
        <div className="myinfo">
          <div className="myrole">
            <span className="me-badge">👤 나 · 좌석 {me.seat + 1}</span>
            <span className={`role-tag role-${me.role}`}>{me.role ? ROLE_LABEL[me.role] : '?'}</span>
            <span className="health">
              {'❤'.repeat(Math.max(0, me.health))}
              <span className="health-lost">{'♡'.repeat(Math.max(0, me.maxHealth - me.health))}</span>
            </span>
          </div>
          <button
            className="mychar tappable"
            onClick={() => setInspect({ title: CHARACTERS[me.character].name, subtitle: `내 캐릭터 · 체력 ${CHARACTERS[me.character].baseHealth}`, body: CHARACTERS[me.character].ability })}
          >
            🎭 <b>{CHARACTERS[me.character].name}</b> — {CHARACTERS[me.character].ability} <span className="info-dot">ⓘ</span>
          </button>
          <div className="mygoal">{me.role ? ROLE_GOAL[me.role] : ''}</div>
          {me.equipment.length > 0 && (
            <div className="my-equipment">
              {me.equipment.map((c) => (
                <Card
                  key={c.id}
                  card={c}
                  small
                  onClick={() => setInspect({ title: CARD_DEFS[c.name].label, subtitle: '내 장비 효과', body: CARD_DEFS[c.name].desc })}
                />
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

        {inspectMode && (
          <div className="targeting-bar info">
            <span>🔍 설명 보기 — 카드를 누르면 효과가 표시됩니다 (사용 안 됨)</span>
            <button className="btn tiny ghost" onClick={() => setInspectMode(false)}>완료</button>
          </div>
        )}

        {discardMode && (
          <div className="targeting-bar discard-bar">
            <span>🗑️ 버리기 — 버릴 카드를 누르세요{overLimit ? ` (한도까지 ${overBy}장)` : ''}</span>
            <button className="btn tiny ghost" onClick={() => setDiscardMode(false)}>완료</button>
          </div>
        )}

        <div className={`hand-row ${discardMode ? 'discarding' : ''}`}>
          {(me.hand ?? []).map((c) => (
            <Card
              key={c.id}
              card={c}
              selected={selected?.cardId === c.id || sidPicks.includes(c.id)}
              disabled={!inspectMode && !sidMode && !(myTurn && !view.pending)}
              onClick={() => onHandCard(c.id, c.name)}
            />
          ))}
          {(me.hand ?? []).length === 0 && <span className="hint">손패가 없습니다.</span>}
        </div>

        <div className="actions">
          {overLimit && !discardMode && (
            <span className="warn">손패 {overBy}장 초과 — 턴 종료하려면 버려야 합니다.</span>
          )}
          <button className="btn tiny ghost" onClick={() => setInspectMode((v) => !v)}>
            {inspectMode ? '설명 끄기' : '🔍 카드 설명'}
          </button>
          {myTurn && !sidMode && !inspectMode && handCount > 0 && (
            <button
              className={`btn tiny ${discardMode ? 'primary' : 'ghost'}`}
              onClick={() => setDiscardMode((v) => !v)}
            >
              {discardMode ? '버리기 끝' : '🗑️ 버리기'}
            </button>
          )}
          {canSid && !sidMode && (
            <button className="btn" onClick={() => { setSidMode(true); setSidPicks([]); }}>
              능력: 2장 버리고 회복
            </button>
          )}
          {myTurn && !sidMode && !discardMode && (
            <button className="btn primary" onClick={endTurnClick}>
              턴 종료
            </button>
          )}
        </div>
      </div>

      {/* 게임 중 채팅 토스트 */}
      <ChatToasts />

      {/* 설명 모달 / 도움말 */}
      {inspect && <InspectModal {...inspect} onClose={() => setInspect(null)} />}
      {showCodex && <Codex onClose={() => setShowCodex(false)} />}

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

      {/* 채팅 패널 */}
      {showChat && (
        <div className="log-panel" onClick={() => setShowChat(false)}>
          <div className="log-inner" onClick={(e) => e.stopPropagation()}>
            <h3>채팅</h3>
            <ChatBox you={me.name} className="panel" />
            <button className="btn ghost" onClick={() => setShowChat(false)}>
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
