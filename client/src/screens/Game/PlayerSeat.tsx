import type { PublicPlayer } from 'shared';
import { Card } from '../../components/Card.js';
import { ROLE_LABEL } from '../../i18n/ko.js';

interface Props {
  player: PublicPlayer;
  isTurn: boolean;
  targetable: boolean;
  onTarget?: () => void;
}

function Health({ p }: { p: PublicPlayer }) {
  return (
    <span className="health" title={`체력 ${p.health}/${p.maxHealth}`}>
      {'❤'.repeat(Math.max(0, p.health))}
      <span className="health-lost">{'♡'.repeat(Math.max(0, p.maxHealth - p.health))}</span>
    </span>
  );
}

export function PlayerSeat({ player, isTurn, targetable, onTarget }: Props) {
  return (
    <div
      className={`seat ${isTurn ? 'turn' : ''} ${targetable ? 'targetable' : ''} ${player.alive ? '' : 'dead'}`}
      onClick={targetable ? onTarget : undefined}
    >
      <div className="seat-head">
        <span className="seat-name">{player.name}</span>
        {player.role && <span className={`role-tag role-${player.role}`}>{ROLE_LABEL[player.role]}</span>}
        {!player.alive && <span className="role-tag dead-tag">사망</span>}
      </div>
      <Health p={player} />
      <div className="seat-hand-count">손패 {player.handCount}장</div>
      {player.equipment.length > 0 && (
        <div className="seat-equipment">
          {player.equipment.map((c) => (
            <Card key={c.id} card={c} small disabled />
          ))}
        </div>
      )}
    </div>
  );
}
