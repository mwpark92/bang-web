import { describe, expect, it } from 'vitest';
import {
  applyAction,
  CHARACTERS,
  createGame,
  type CardName,
  type CharacterId,
  type GameState,
  type Player,
} from '../src/index.js';

function makePlayers(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
}

function cur(state: GameState): Player {
  return state.players.find((p) => p.seat === state.turnSeat)!;
}

let injSeq = 0;
function giveCard(_state: GameState, p: Player, name: CardName): string {
  const card = { id: `inj-${name}-${injSeq++}`, name, suit: 'clubs' as const, rank: 'K' as const };
  p.hand.push(card);
  return card.id;
}

/** 캐릭터 영향을 제거한 결정적 기준 상태로 정리 */
function prep(s: GameState, char: CharacterId = 'bartCassidy'): void {
  s.pending = null;
  for (const p of s.players) p.character = char;
}

function seatPlayer(s: GameState, fromSeat: number, offset: number): Player {
  const n = s.players.length;
  return s.players.find((p) => p.seat === (fromSeat + offset + n) % n)!;
}

describe('역할 분배', () => {
  it('4인은 보안관1 배신자1 무법자2', () => {
    const s = createGame(makePlayers(4), 1);
    const roles = s.players.map((p) => p.role).sort();
    expect(roles).toEqual(['outlaw', 'outlaw', 'renegade', 'sheriff']);
  });
  it('7인은 보안관1 부관2 무법자3 배신자1', () => {
    const s = createGame(makePlayers(7), 1);
    const count = (r: string) => s.players.filter((p) => p.role === r).length;
    expect(count('sheriff')).toBe(1);
    expect(count('deputy')).toBe(2);
    expect(count('outlaw')).toBe(3);
    expect(count('renegade')).toBe(1);
  });
});

describe('캐릭터 분배 / 체력', () => {
  it('모든 플레이어는 서로 다른 캐릭터를 받는다', () => {
    const s = createGame(makePlayers(7), 1);
    const chars = new Set(s.players.map((p) => p.character));
    expect(chars.size).toBe(7);
  });
  it('체력은 캐릭터 기본체력 + (보안관이면 1)', () => {
    const s = createGame(makePlayers(4), 1);
    for (const p of s.players) {
      const expected = CHARACTERS[p.character].baseHealth + (p.role === 'sheriff' ? 1 : 0);
      expect(p.maxHealth).toBe(expected);
    }
  });
  it('보안관이 첫 턴이다', () => {
    const s = createGame(makePlayers(4), 1);
    const sheriff = s.players.find((p) => p.role === 'sheriff')!;
    expect(s.turnSeat).toBe(sheriff.seat);
  });
});

describe('뱅! / 빗나감!', () => {
  it('인접 대상에게 뱅!을 쏘면 막지 못할 때 1 피해', () => {
    const s = createGame(makePlayers(4), 1);
    prep(s);
    const attacker = cur(s);
    const target = seatPlayer(s, attacker.seat, 1);
    target.hand = [];
    target.health = 4;
    const bangId = giveCard(s, attacker, 'bang');
    applyAction(s, { type: 'playCard', playerId: attacker.id, cardId: bangId, targetId: target.id });
    expect(s.pending?.kind).toBe('bang');
    applyAction(s, { type: 'respond', playerId: target.id });
    expect(target.health).toBe(3);
    expect(s.pending).toBeNull();
  });

  it('빗나감!으로 막으면 피해 없음', () => {
    const s = createGame(makePlayers(4), 1);
    prep(s);
    const attacker = cur(s);
    const target = seatPlayer(s, attacker.seat, 1);
    target.hand = [];
    target.health = 4;
    const missedId = giveCard(s, target, 'missed');
    const bangId = giveCard(s, attacker, 'bang');
    applyAction(s, { type: 'playCard', playerId: attacker.id, cardId: bangId, targetId: target.id });
    applyAction(s, { type: 'respond', playerId: target.id, cardId: missedId });
    expect(target.health).toBe(4);
    expect(s.pending).toBeNull();
  });

  it('한 턴에 뱅!은 한 번만', () => {
    const s = createGame(makePlayers(4), 1);
    prep(s);
    const attacker = cur(s);
    const target = seatPlayer(s, attacker.seat, 1);
    target.hand = [];
    const bang1 = giveCard(s, attacker, 'bang');
    const bang2 = giveCard(s, attacker, 'bang');
    applyAction(s, { type: 'playCard', playerId: attacker.id, cardId: bang1, targetId: target.id });
    applyAction(s, { type: 'respond', playerId: target.id });
    applyAction(s, { type: 'playCard', playerId: attacker.id, cardId: bang2, targetId: target.id });
    expect(s.pending).toBeNull();
    expect(attacker.hand.some((c) => c.id === bang2)).toBe(true);
  });
});

describe('캐릭터 특수능력', () => {
  it('윌리 더 키드는 뱅!을 여러 번 낼 수 있다', () => {
    const s = createGame(makePlayers(4), 1);
    prep(s);
    const attacker = cur(s);
    attacker.character = 'willyTheKid';
    const t1 = seatPlayer(s, attacker.seat, 1);
    const t2 = seatPlayer(s, attacker.seat, -1);
    t1.hand = []; t2.hand = [];
    const b1 = giveCard(s, attacker, 'bang');
    const b2 = giveCard(s, attacker, 'bang');
    applyAction(s, { type: 'playCard', playerId: attacker.id, cardId: b1, targetId: t1.id });
    applyAction(s, { type: 'respond', playerId: t1.id });
    applyAction(s, { type: 'playCard', playerId: attacker.id, cardId: b2, targetId: t2.id });
    expect(s.pending?.kind).toBe('bang');
  });

  it('슬랩 더 킬러의 뱅!은 빗나감! 2장이 필요', () => {
    const s = createGame(makePlayers(4), 1);
    prep(s);
    const attacker = cur(s);
    attacker.character = 'slabTheKiller';
    const target = seatPlayer(s, attacker.seat, 1);
    target.hand = [];
    target.health = 4;
    const missed = giveCard(s, target, 'missed');
    const bang = giveCard(s, attacker, 'bang');
    applyAction(s, { type: 'playCard', playerId: attacker.id, cardId: bang, targetId: target.id });
    applyAction(s, { type: 'respond', playerId: target.id, cardId: missed }); // 1장만
    expect(s.pending?.kind).toBe('bang'); // 아직 1장 더 필요
    applyAction(s, { type: 'respond', playerId: target.id }); // 포기
    expect(target.health).toBe(3);
    expect(s.pending).toBeNull();
  });

  it('칼라미티 자넷은 빗나감! 대신 뱅!으로 방어할 수 있다', () => {
    const s = createGame(makePlayers(4), 1);
    prep(s);
    const attacker = cur(s);
    const target = seatPlayer(s, attacker.seat, 1);
    target.character = 'calamityJanet';
    target.hand = [];
    target.health = 4;
    const bangDef = giveCard(s, target, 'bang'); // 뱅!을 빗나감!처럼
    const bang = giveCard(s, attacker, 'bang');
    applyAction(s, { type: 'playCard', playerId: attacker.id, cardId: bang, targetId: target.id });
    applyAction(s, { type: 'respond', playerId: target.id, cardId: bangDef });
    expect(target.health).toBe(4);
    expect(s.pending).toBeNull();
  });

  it('바트 캐시디는 피해를 입으면 카드를 뽑는다', () => {
    const s = createGame(makePlayers(4), 1);
    prep(s);
    const attacker = cur(s);
    const target = seatPlayer(s, attacker.seat, 1);
    target.character = 'bartCassidy';
    target.hand = [];
    target.health = 4;
    const bang = giveCard(s, attacker, 'bang');
    applyAction(s, { type: 'playCard', playerId: attacker.id, cardId: bang, targetId: target.id });
    applyAction(s, { type: 'respond', playerId: target.id }); // 1 피해
    expect(target.health).toBe(3);
    expect(target.hand.length).toBe(1); // 잃은 체력 1당 1장
  });

  it('폴 리그렛은 다른 사람이 보는 거리가 +1 (사거리 1 뱅 불가)', () => {
    const s = createGame(makePlayers(4), 1);
    prep(s);
    const attacker = cur(s);
    const target = seatPlayer(s, attacker.seat, 1);
    target.character = 'paulRegret'; // 거리 1 → 2
    const bang = giveCard(s, attacker, 'bang');
    applyAction(s, { type: 'playCard', playerId: attacker.id, cardId: bang, targetId: target.id });
    expect(s.pending).toBeNull(); // 사거리 밖이라 발동 안 됨
    expect(attacker.hand.some((c) => c.id === bang)).toBe(true);
  });

  it('시드 케첨은 카드 2장을 버리고 체력을 회복한다', () => {
    const s = createGame(makePlayers(4), 1);
    prep(s);
    const p = cur(s);
    p.character = 'sidKetchum';
    p.health = 2;
    p.maxHealth = 4;
    p.hand = [];
    const c1 = giveCard(s, p, 'beer');
    const c2 = giveCard(s, p, 'beer');
    applyAction(s, { type: 'ability', playerId: p.id, cardIds: [c1, c2] });
    expect(p.health).toBe(3);
    expect(p.hand.length).toBe(0);
  });
});

describe('턴 종료 / 손패 한도', () => {
  it('손패 초과 시 종료 거부, 버린 뒤 종료 가능', () => {
    const s = createGame(makePlayers(4), 1);
    prep(s);
    const p = cur(s);
    p.health = 4;
    while (p.hand.length <= p.health) giveCard(s, p, 'beer');
    const beforeSeat = s.turnSeat;
    applyAction(s, { type: 'endTurn', playerId: p.id });
    expect(s.turnSeat).toBe(beforeSeat);
    while (p.hand.length > p.health) {
      applyAction(s, { type: 'discard', playerId: p.id, cardId: p.hand[0].id });
    }
    applyAction(s, { type: 'endTurn', playerId: p.id });
    expect(s.turnSeat).not.toBe(beforeSeat);
  });
});

describe('승리 판정', () => {
  it('보안관이 개틀링으로 무법자/배신자를 모두 처치하면 보안관 승리', () => {
    const s = createGame(makePlayers(4), 1);
    prep(s);
    const sheriff = s.players.find((p) => p.role === 'sheriff')!;
    s.turnSeat = sheriff.seat;
    for (const p of s.players) {
      if (p.id !== sheriff.id) { p.health = 1; p.hand = []; p.equipment = []; }
    }
    const gatlingId = giveCard(s, sheriff, 'gatling');
    applyAction(s, { type: 'playCard', playerId: sheriff.id, cardId: gatlingId });
    let guard = 0;
    while (s.pending?.kind === 'gatling' && guard++ < 10) {
      applyAction(s, { type: 'respond', playerId: s.pending.remaining[0] });
    }
    expect(s.phase).toBe('over');
    expect(s.winner).toBe('sheriff');
  });
});
