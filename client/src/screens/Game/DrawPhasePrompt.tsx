import type { ReactNode } from 'react';
import { CARD_DEFS, type ClientView } from 'shared';
import { Card } from '../../components/Card.js';
import { store } from '../../net/useStore.js';

export function DrawPhasePrompt({ view }: { view: ClientView }) {
  const pend = view.pending;
  if (!pend) return null;

  // 킷 칼슨: 3장 중 1장을 덱 위로
  if (pend.kind === 'drawSelect') {
    if (pend.playerId !== view.you) return null;
    return (
      <Overlay>
        <h3>킷 칼슨 — 덱 위로 되돌릴 카드 1장을 고르세요</h3>
        <p className="prompt-desc">고른 카드를 제외한 나머지 2장을 가져갑니다.</p>
        <div className="prompt-cards">
          {pend.cards.map((c) => (
            <Card key={c.id} card={c} onClick={() => store.send({ type: 'drawSelect', putBackId: c.id })} />
          ))}
        </div>
      </Overlay>
    );
  }

  // 제시 존스 / 페드로 라미레즈: 첫 카드 출처 선택
  if (pend.kind === 'drawChoice') {
    if (pend.playerId !== view.you) return null;

    if (pend.character === 'jesseJones') {
      const victims = view.players.filter((p) => !p.isYou && p.alive && p.handCount > 0);
      return (
        <Overlay>
          <h3>제시 존스 — 첫 카드를 어디서 뽑을까요?</h3>
          <div className="btn-col">
            {victims.map((p) => (
              <button
                key={p.id}
                className="btn"
                onClick={() => store.send({ type: 'drawChoice', source: 'player', targetId: p.id })}
              >
                {p.name}의 손패에서 1장 ({p.handCount}장)
              </button>
            ))}
            <button className="btn primary" onClick={() => store.send({ type: 'drawChoice', source: 'deck' })}>
              덱에서 2장 뽑기
            </button>
          </div>
        </Overlay>
      );
    }

    if (pend.character === 'pedroRamirez') {
      return (
        <Overlay>
          <h3>페드로 라미레즈 — 첫 카드를 어디서 가져올까요?</h3>
          {view.discardTop && (
            <div className="prompt-cards">
              <Card card={view.discardTop} disabled />
            </div>
          )}
          <div className="btn-col">
            <button className="btn" onClick={() => store.send({ type: 'drawChoice', source: 'discard' })}>
              버린 더미 맨 위 가져오기{view.discardTop ? ` (${CARD_DEFS[view.discardTop.name].label})` : ''}
            </button>
            <button className="btn primary" onClick={() => store.send({ type: 'drawChoice', source: 'deck' })}>
              덱에서 2장 뽑기
            </button>
          </div>
        </Overlay>
      );
    }
  }

  return null;
}

function Overlay({ children }: { children: ReactNode }) {
  return (
    <div className="modal-overlay">
      <div className="modal">{children}</div>
    </div>
  );
}
