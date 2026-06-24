import { isWeapon, weaponRangeOf } from './cards.js';
import type { GameState, Player } from './types.js';

export function hasEquipment(p: Player, name: string): boolean {
  return p.equipment.some((c) => c.name === name);
}

/** 조준경 효과 보유 (장비 또는 로즈 둘란) */
export function hasScope(p: Player): boolean {
  return hasEquipment(p, 'scope') || p.character === 'roseDoolan';
}

/** 머스탱 효과 보유 (장비 또는 폴 리그렛) */
export function hasMustang(p: Player): boolean {
  return hasEquipment(p, 'mustang') || p.character === 'paulRegret';
}

/** 나무통 효과 보유 (장비 또는 조르도네) */
export function hasBarrel(p: Player): boolean {
  return hasEquipment(p, 'barrel') || p.character === 'jourdonnais';
}

/** 현재 무기 사거리 (무기 없으면 1) */
export function weaponRange(p: Player): number {
  let range = 1;
  for (const c of p.equipment) {
    if (isWeapon(c.name)) range = Math.max(range, weaponRangeOf(c.name));
  }
  return range;
}

/** 좌석 원형에서 살아있는 두 플레이어 사이의 기본 거리 */
export function baseDistance(state: GameState, from: Player, to: Player): number {
  if (from.id === to.id) return 0;
  const alive = state.players.filter((p) => p.alive).sort((a, b) => a.seat - b.seat);
  const n = alive.length;
  const i = alive.findIndex((p) => p.id === from.id);
  const j = alive.findIndex((p) => p.id === to.id);
  if (i < 0 || j < 0) return Infinity;
  const cw = (j - i + n) % n;
  const ccw = (i - j + n) % n;
  return Math.min(cw, ccw);
}

/**
 * from이 보는 to까지의 실제 거리.
 * - from의 조준경(scope): -1
 * - to의 머스탱(mustang): +1
 * 최소 1.
 */
export function distance(state: GameState, from: Player, to: Player): number {
  let d = baseDistance(state, from, to);
  if (hasScope(from)) d -= 1;
  if (hasMustang(to)) d += 1;
  return Math.max(1, d);
}

/** from이 무기 사거리로 to를 공격할 수 있는가 */
export function inWeaponRange(state: GameState, from: Player, to: Player): boolean {
  return distance(state, from, to) <= weaponRange(from);
}
