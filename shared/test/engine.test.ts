import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createGame,
  type GameState,
  type Player,
} from '../src/index.js';

function makePlayers(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
}

function cur(state: GameState): Player {
  return state.players.find((p) => p.seat === state.turnSeat)!;
}

function giveCard(state: GameState, p: Player, name: any): string {
  const card = { id: `inj-${name}-${Math.random()}`, name, suit: 'clubs' as const, rank: 'K' as const };
  p.hand.push(card);
  return card.id;
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
  it('보안관 체력은 5, 나머지는 4', () => {
    const s = createGame(makePlayers(4), 1);
    for (const p of s.players) {
      expect(p.maxHealth).toBe(p.role === 'sheriff' ? 5 : 4);
    }
  });
});

describe('초기 상태', () => {
  it('보안관이 첫 턴이고 손패는 체력만큼 + 2장 뽑음', () => {
    const s = createGame(makePlayers(4), 1);
    const sheriff = s.players.find((p) => p.role === 'sheriff')!;
    expect(s.turnSeat).toBe(sheriff.seat);
    // 초기 5장(체력) + 턴 시작 2장
    expect(sheriff.hand.length).toBe(7);
  });
});

describe('뱅! / 빗나감!', () => {
  it('인접한 대상에게 뱅!을 쏘면 막지 못할 때 1 피해', () => {
    const s = createGame(makePlayers(4), 1);
    const attacker = cur(s);
    // 거리 1 대상: 다음 좌석
    const target = s.players.find((p) => p.seat === (attacker.seat + 1) % 4)!;
    target.hand = []; // 빗나감 없음
    const startHp = target.health;
    const bangId = giveCard(s, attacker, 'bang');
    applyAction(s, { type: 'playCard', playerId: attacker.id, cardId: bangId, targetId: target.id });
    expect(s.pending?.kind).toBe('bang');
    applyAction(s, { type: 'respond', playerId: target.id }); // 응답 포기
    expect(target.health).toBe(startHp - 1);
    expect(s.pending).toBeNull();
  });

  it('빗나감!으로 뱅을 막으면 피해 없음', () => {
    const s = createGame(makePlayers(4), 1);
    const attacker = cur(s);
    const target = s.players.find((p) => p.seat === (attacker.seat + 1) % 4)!;
    target.hand = [];
    const missedId = giveCard(s, target, 'missed');
    const startHp = target.health;
    const bangId = giveCard(s, attacker, 'bang');
    applyAction(s, { type: 'playCard', playerId: attacker.id, cardId: bangId, targetId: target.id });
    applyAction(s, { type: 'respond', playerId: target.id, cardId: missedId });
    expect(target.health).toBe(startHp);
    expect(s.pending).toBeNull();
  });

  it('한 턴에 뱅!은 한 번만', () => {
    const s = createGame(makePlayers(4), 1);
    const attacker = cur(s);
    const target = s.players.find((p) => p.seat === (attacker.seat + 1) % 4)!;
    target.hand = [];
    const bang1 = giveCard(s, attacker, 'bang');
    const bang2 = giveCard(s, attacker, 'bang');
    applyAction(s, { type: 'playCard', playerId: attacker.id, cardId: bang1, targetId: target.id });
    applyAction(s, { type: 'respond', playerId: target.id });
    // 두 번째 뱅은 무시됨
    applyAction(s, { type: 'playCard', playerId: attacker.id, cardId: bang2, targetId: target.id });
    expect(s.pending).toBeNull();
    expect(attacker.hand.some((c) => c.id === bang2)).toBe(true);
  });
});

describe('턴 종료 / 손패 한도', () => {
  it('손패가 체력 이하일 때만 턴 종료 가능', () => {
    const s = createGame(makePlayers(4), 1);
    const p = cur(s);
    p.hand = p.hand.slice(0, p.health); // 한도 이하로
    const beforeSeat = s.turnSeat;
    applyAction(s, { type: 'endTurn', playerId: p.id });
    expect(s.turnSeat).not.toBe(beforeSeat);
  });

  it('손패 초과 시 종료 거부, 버린 뒤 종료 가능', () => {
    const s = createGame(makePlayers(4), 1);
    const p = cur(s);
    while (p.hand.length <= p.health) giveCard(s, p, 'beer');
    const beforeSeat = s.turnSeat;
    applyAction(s, { type: 'endTurn', playerId: p.id });
    expect(s.turnSeat).toBe(beforeSeat); // 거부됨
    while (p.hand.length > p.health) {
      applyAction(s, { type: 'discard', playerId: p.id, cardId: p.hand[0].id });
    }
    applyAction(s, { type: 'endTurn', playerId: p.id });
    expect(s.turnSeat).not.toBe(beforeSeat);
  });
});

describe('승리 판정', () => {
  it('보안관이 개틀링으로 모든 무법자/배신자를 처치하면 보안관 승리', () => {
    const s = createGame(makePlayers(4), 1);
    const sheriff = s.players.find((p) => p.role === 'sheriff')!;
    expect(s.turnSeat).toBe(sheriff.seat); // 보안관이 첫 턴
    // 나머지 모두 체력 1, 손패 없음(빗나감/나무통 불가)
    for (const p of s.players) {
      if (p.id !== sheriff.id) { p.health = 1; p.hand = []; p.equipment = []; }
    }
    const gatlingId = giveCard(s, sheriff, 'gatling');
    applyAction(s, { type: 'playCard', playerId: sheriff.id, cardId: gatlingId });
    // 남은 대상들이 차례로 응답 포기
    let guard = 0;
    while (s.pending?.kind === 'gatling' && guard++ < 10) {
      const target = s.pending.remaining[0];
      applyAction(s, { type: 'respond', playerId: target });
    }
    expect(s.phase).toBe('over');
    expect(s.winner).toBe('sheriff');
  });

  it('결투에서 패배하면 피해를 입는다', () => {
    const s = createGame(makePlayers(4), 1);
    const attacker = cur(s);
    const target = s.players.find((p) => p.seat === (attacker.seat + 1) % 4)!;
    target.hand = []; // 결투에서 응수할 뱅 없음
    const startHp = target.health;
    const duelId = giveCard(s, attacker, 'duel');
    applyAction(s, { type: 'playCard', playerId: attacker.id, cardId: duelId, targetId: target.id });
    // 결투를 받은 target이 먼저 내야 하는데 뱅이 없어 포기 -> target 피해
    expect(s.pending?.kind).toBe('duel');
    applyAction(s, { type: 'respond', playerId: target.id });
    expect(target.health).toBe(startHp - 1);
    expect(s.pending).toBeNull();
  });
});
