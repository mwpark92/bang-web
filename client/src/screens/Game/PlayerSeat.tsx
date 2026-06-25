import type { MouseEvent } from 'react';
import { CARD_DEFS, CHARACTERS, type Card as CardT, type PublicPlayer } from 'shared';
import { Card } from '../../components/Card.js';
import { ROLE_LABEL } from '../../i18n/ko.js';

export interface InspectPayload {
  title: string;
  subtitle?: string;
  body: string;
}

interface Props {
  player: PublicPlayer;
  isTurn: boolean;
  targetable: boolean;
  posLabel?: string;        // 나 기준 위치 (예: "왼쪽 1", "거리 2")
  onTarget?: () => void;
  onInspect: (info: InspectPayload) => void;
}

function Health({ p }: { p: PublicPlayer }) {
  return (
    <span className="health" title={`체력 ${p.health}/${p.maxHealth}`}>
      {'❤'.repeat(Math.max(0, p.health))}
      <span className="health-lost">{'♡'.repeat(Math.max(0, p.maxHealth - p.health))}</span>
    </span>
  );
}

export function PlayerSeat({ player, isTurn, targetable, posLabel, onTarget, onInspect }: Props) {
  const char = CHARACTERS[player.character];
  const inspectChar = (e: MouseEvent) => {
    e.stopPropagation();
    onInspect({ title: char.name, subtitle: `캐릭터 능력 · 체력 ${char.baseHealth}`, body: char.ability });
  };
  const inspectCard = (e: MouseEvent, c: CardT) => {
    e.stopPropagation();
    onInspect({ title: CARD_DEFS[c.name].label, subtitle: '장비 효과', body: CARD_DEFS[c.name].desc });
  };

  return (
    <div
      className={`seat ${isTurn ? 'turn' : ''} ${targetable ? 'targetable' : ''} ${player.alive ? '' : 'dead'}`}
      onClick={targetable ? onTarget : undefined}
    >
      <div className="seat-head">
        {posLabel && <span className="seat-pos">{posLabel}</span>}
        <span className="seat-name">{player.name}</span>
        {player.role && <span className={`role-tag role-${player.role}`}>{ROLE_LABEL[player.role]}</span>}
        {!player.alive && <span className="role-tag dead-tag">사망</span>}
      </div>
      <button className="seat-char tappable" onClick={inspectChar} title="능력 보기">
        🎭 {char.name} <span className="info-dot">ⓘ</span>
      </button>
      <Health p={player} />
      <div className="seat-hand-count">손패 {player.handCount}장</div>
      {player.equipment.length > 0 && (
        <div className="seat-equipment">
          {player.equipment.map((c) => (
            <Card key={c.id} card={c} small onClick={(e) => inspectCard(e, c)} />
          ))}
        </div>
      )}
    </div>
  );
}
