import type { ReactNode } from 'react';
import type { ClientView } from 'shared';
import { CARD_DEFS } from 'shared';
import { Card } from '../../components/Card.js';
import { store } from '../../net/useStore.js';

export function ResponsePrompt({ view }: { view: ClientView }) {
  const pend = view.pending;
  if (!pend) return null;
  const me = view.players.find((p) => p.isYou);
  const myHand = me?.hand ?? [];
  const calamity = me?.character === 'calamityJanet';
  // 칼라미티 자넷: 뱅!↔빗나감! 호환
  const asMissed = myHand.filter((c) => c.name === 'missed' || (calamity && c.name === 'bang'));
  const asBang = myHand.filter((c) => c.name === 'bang' || (calamity && c.name === 'missed'));

  // 잡화점: 내 차례에 카드 고르기
  if (pend.kind === 'generalStore') {
    if (pend.order[0] !== view.you) return null;
    return (
      <Modal title="잡화점 — 카드를 한 장 고르세요">
        <div className="prompt-cards">
          {pend.revealed.map((c) => (
            <Card key={c.id} card={c} onClick={() => store.send({ type: 'generalStorePick', cardId: c.id })} />
          ))}
        </div>
      </Modal>
    );
  }

  if (!view.awaitingYourResponse) return null;

  if (pend.kind === 'bang' || pend.kind === 'gatling') {
    return (
      <Modal title={pend.kind === 'bang' ? '뱅!을 맞았습니다!' : '개틀링을 맞았습니다!'}>
        <p className="prompt-desc">
          빗나감!으로 막거나 1 피해를 받으세요.
          {pend.kind === 'bang' && pend.missesNeeded > 1 ? ` (빗나감! ${pend.missesNeeded}장 필요)` : ''}
        </p>
        <div className="prompt-cards">
          {asMissed.map((c) => (
            <Card key={c.id} card={c} onClick={() => store.send({ type: 'respond', cardId: c.id })} />
          ))}
        </div>
        <button className="btn danger" onClick={() => store.send({ type: 'respond' })}>
          맞기 (1 피해)
        </button>
      </Modal>
    );
  }

  if (pend.kind === 'indians') {
    return (
      <Modal title="인디언의 습격!">
        <p className="prompt-desc">뱅!을 버리거나 1 피해를 받으세요.</p>
        <div className="prompt-cards">
          {asBang.map((c) => (
            <Card key={c.id} card={c} onClick={() => store.send({ type: 'respond', cardId: c.id })} />
          ))}
        </div>
        <button className="btn danger" onClick={() => store.send({ type: 'respond' })}>
          1 피해 받기
        </button>
      </Modal>
    );
  }

  if (pend.kind === 'duel') {
    return (
      <Modal title="결투 중!">
        <p className="prompt-desc">{CARD_DEFS.bang.label}으로 응수하거나 패배(1 피해)하세요.</p>
        <div className="prompt-cards">
          {asBang.map((c) => (
            <Card key={c.id} card={c} onClick={() => store.send({ type: 'respond', cardId: c.id })} />
          ))}
        </div>
        <button className="btn danger" onClick={() => store.send({ type: 'respond' })}>
          패배 (1 피해)
        </button>
      </Modal>
    );
  }

  return null;
}

function Modal({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}
