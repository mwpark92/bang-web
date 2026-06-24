import { weaponRange } from './distance.js';
import type { ClientView, GameState, PublicPlayer } from './types.js';

/** 서버의 전체 GameState를 특정 플레이어 시점의 (가려진) 뷰로 변환 */
export function redact(state: GameState, viewerId: string): ClientView {
  const players: PublicPlayer[] = state.players.map((p) => {
    const isYou = p.id === viewerId;
    const roleVisible = isYou || p.roleRevealed;
    return {
      id: p.id,
      name: p.name,
      seat: p.seat,
      role: roleVisible ? p.role : null,
      isYou,
      maxHealth: p.maxHealth,
      health: p.health,
      alive: p.alive,
      handCount: p.hand.length,
      hand: isYou ? p.hand : null,
      equipment: p.equipment,
      weaponRange: weaponRange(p),
    };
  });

  const cur = state.players.find((p) => p.seat === state.turnSeat);
  const yourTurn = !!cur && cur.id === viewerId && !state.pending && state.phase === 'playing';
  const awaitingYourResponse = isAwaiting(state, viewerId);

  return {
    you: viewerId,
    players,
    deckCount: state.deck.length,
    discardTop: state.discard.length ? state.discard[state.discard.length - 1] : null,
    discardCount: state.discard.length,
    turnSeat: state.turnSeat,
    phase: state.phase,
    pending: state.pending,
    winner: state.winner,
    log: state.log.slice(-40),
    yourTurn,
    awaitingYourResponse,
  };
}

function isAwaiting(state: GameState, viewerId: string): boolean {
  const pend = state.pending;
  if (!pend) return false;
  switch (pend.kind) {
    case 'bang': return pend.targetId === viewerId;
    case 'gatling':
    case 'indians': return pend.remaining[0] === viewerId;
    case 'duel': return pend.currentId === viewerId;
    case 'generalStore': return pend.order[0] === viewerId;
  }
}
