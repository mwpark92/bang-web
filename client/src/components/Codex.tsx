import { useState } from 'react';
import { ALL_CHARACTERS, CARD_DEFS, CHARACTERS, type CardName } from 'shared';

const CARD_ORDER: CardName[] = [
  'bang', 'missed', 'beer', 'saloon', 'stagecoach', 'wellsFargo',
  'indians', 'gatling', 'duel', 'generalStore', 'panic', 'catBalou',
  'volcanic', 'schofield', 'remington', 'carbine', 'winchester',
  'mustang', 'scope', 'barrel', 'jail', 'dynamite',
];

/** 카드/캐릭터 전체 능력을 한 곳에서 보는 도움말 */
export function Codex({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'cards' | 'chars'>('cards');
  return (
    <div className="log-panel" onClick={onClose}>
      <div className="log-inner codex" onClick={(e) => e.stopPropagation()}>
        <div className="codex-tabs">
          <button className={`btn tiny ${tab === 'cards' ? 'primary' : 'ghost'}`} onClick={() => setTab('cards')}>카드</button>
          <button className={`btn tiny ${tab === 'chars' ? 'primary' : 'ghost'}`} onClick={() => setTab('chars')}>캐릭터</button>
        </div>
        <div className="codex-list">
          {tab === 'cards'
            ? CARD_ORDER.map((name) => (
                <div key={name} className="codex-row">
                  <span className={`codex-tag ${CARD_DEFS[name].category}`}>{CARD_DEFS[name].label}</span>
                  <span className="codex-desc">{CARD_DEFS[name].desc}</span>
                </div>
              ))
            : ALL_CHARACTERS.map((id) => (
                <div key={id} className="codex-row">
                  <span className="codex-tag char">{CHARACTERS[id].name}</span>
                  <span className="codex-desc">체력 {CHARACTERS[id].baseHealth} · {CHARACTERS[id].ability}</span>
                </div>
              ))}
        </div>
        <button className="btn ghost" onClick={onClose}>닫기</button>
      </div>
    </div>
  );
}
