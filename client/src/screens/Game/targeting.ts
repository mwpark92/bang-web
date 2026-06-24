import type { CardName, ClientView, PublicPlayer } from 'shared';

export const TARGETED_CARDS = new Set<CardName>(['bang', 'panic', 'catBalou', 'duel', 'jail']);
export const CARD_PICK_CARDS = new Set<CardName>(['panic', 'catBalou']);

function hasEq(p: PublicPlayer, name: string): boolean {
  return p.equipment.some((c) => c.name === name);
}

function hasScope(p: PublicPlayer): boolean {
  return hasEq(p, 'scope') || p.character === 'roseDoolan';
}
function hasMustang(p: PublicPlayer): boolean {
  return hasEq(p, 'mustang') || p.character === 'paulRegret';
}

/** 살아있는 플레이어들 사이의 좌석 기본 거리 */
function baseDistance(players: PublicPlayer[], fromSeat: number, toSeat: number): number {
  const alive = players.filter((p) => p.alive).sort((a, b) => a.seat - b.seat);
  const n = alive.length;
  const i = alive.findIndex((p) => p.seat === fromSeat);
  const j = alive.findIndex((p) => p.seat === toSeat);
  if (i < 0 || j < 0) return Infinity;
  const cw = (j - i + n) % n;
  const ccw = (i - j + n) % n;
  return Math.min(cw, ccw);
}

/** from이 보는 to까지의 거리 (조준경/머스탱 반영) */
export function viewDistance(players: PublicPlayer[], from: PublicPlayer, to: PublicPlayer): number {
  let d = baseDistance(players, from.seat, to.seat);
  if (hasScope(from)) d -= 1;
  if (hasMustang(to)) d += 1;
  return Math.max(1, d);
}

/** 해당 카드로 겨눌 수 있는 대상 playerId 목록 */
export function validTargets(view: ClientView, cardName: CardName): Set<string> {
  const me = view.players.find((p) => p.isYou);
  const out = new Set<string>();
  if (!me) return out;
  for (const p of view.players) {
    if (!p.alive || p.isYou) continue;
    switch (cardName) {
      case 'bang':
        if (viewDistance(view.players, me, p) <= me.weaponRange) out.add(p.id);
        break;
      case 'panic':
        if (viewDistance(view.players, me, p) <= 1 && (p.handCount > 0 || p.equipment.length > 0)) out.add(p.id);
        break;
      case 'catBalou':
        if (p.handCount > 0 || p.equipment.length > 0) out.add(p.id);
        break;
      case 'duel':
        out.add(p.id);
        break;
      case 'jail':
        if (p.role !== 'sheriff' && !hasEq(p, 'jail')) out.add(p.id);
        break;
      default:
        break;
    }
  }
  return out;
}
