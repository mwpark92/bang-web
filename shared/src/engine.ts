import {
  buildDeck,
  CARD_DEFS,
  isDynamiteExplosion,
  isHeart,
  isWeapon,
} from './cards.js';
import { distance, hasEquipment, inWeaponRange } from './distance.js';
import type {
  Card,
  GameAction,
  GameState,
  Player,
  Role,
} from './types.js';

export interface PlayerInit {
  id: string;
  name: string;
}

const BASE_HEALTH = 4;
const SHERIFF_BONUS = 1;

// ===== RNG (mulberry32, 결정적) =====

function nextRand(state: GameState): number {
  let t = (state.rng = (state.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function shuffle<T>(state: GameState, arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand(state) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ===== 로그 =====

function log(state: GameState, text: string): void {
  state.logSeq += 1;
  state.log.push({ id: state.logSeq, text });
  if (state.log.length > 200) state.log.shift();
}

function nameOf(state: GameState, id: string): string {
  return state.players.find((p) => p.id === id)?.name ?? '?';
}

// ===== 역할 분배 =====

function roleSetup(n: number): Role[] {
  switch (n) {
    case 4: return ['sheriff', 'renegade', 'outlaw', 'outlaw'];
    case 5: return ['sheriff', 'renegade', 'outlaw', 'outlaw', 'deputy'];
    case 6: return ['sheriff', 'renegade', 'outlaw', 'outlaw', 'outlaw', 'deputy'];
    case 7: return ['sheriff', 'renegade', 'outlaw', 'outlaw', 'outlaw', 'deputy', 'deputy'];
    default: throw new Error('플레이어 수는 4~7명이어야 합니다.');
  }
}

// ===== 게임 생성 =====

export function createGame(players: PlayerInit[], seed = Date.now()): GameState {
  if (players.length < 4 || players.length > 7) {
    throw new Error('플레이어 수는 4~7명이어야 합니다.');
  }
  const state: GameState = {
    players: [],
    deck: [],
    discard: [],
    turnSeat: 0,
    phase: 'playing',
    pending: null,
    winner: null,
    log: [],
    rng: seed >>> 0,
    logSeq: 0,
    bangsPlayedThisTurn: 0,
  };

  const roles = roleSetup(players.length);
  shuffle(state, roles);

  state.players = players.map((p, seat) => {
    const role = roles[seat];
    const maxHealth = BASE_HEALTH + (role === 'sheriff' ? SHERIFF_BONUS : 0);
    return {
      id: p.id,
      name: p.name,
      seat,
      role,
      roleRevealed: role === 'sheriff',
      maxHealth,
      health: maxHealth,
      alive: true,
      hand: [],
      equipment: [],
    };
  });

  state.deck = buildDeck();
  shuffle(state, state.deck);

  // 초기 손패: 체력(총알) 수만큼
  for (const p of state.players) {
    for (let i = 0; i < p.health; i++) {
      const c = drawOne(state);
      if (c) p.hand.push(c);
    }
  }

  const sheriff = state.players.find((p) => p.role === 'sheriff')!;
  state.turnSeat = sheriff.seat;
  log(state, `게임 시작! 보안관은 ${sheriff.name}입니다.`);
  beginTurn(state);
  return state;
}

// ===== 덱 조작 =====

function drawOne(state: GameState): Card | null {
  if (state.deck.length === 0) {
    if (state.discard.length === 0) return null;
    // 버린 더미를 섞어 새 덱으로
    const top = state.discard.pop()!; // 맨 위 한 장은 남겨두는 변형 대신 전부 재활용
    state.deck = state.discard;
    state.discard = [top];
    shuffle(state, state.deck);
    log(state, '덱이 떨어져 버린 더미를 다시 섞었습니다.');
  }
  return state.deck.pop() ?? null;
}

function draw(state: GameState, p: Player, n: number): void {
  for (let i = 0; i < n; i++) {
    const c = drawOne(state);
    if (c) p.hand.push(c);
  }
}

/** draw! — 한 장 공개 후 버린 더미로 보냄 */
function drawBang(state: GameState): Card | null {
  const c = drawOne(state);
  if (c) state.discard.push(c);
  return c;
}

function discardCard(state: GameState, card: Card): void {
  state.discard.push(card);
}

function removeFromHand(p: Player, cardId: string): Card | null {
  const i = p.hand.findIndex((c) => c.id === cardId);
  if (i < 0) return null;
  return p.hand.splice(i, 1)[0];
}

// ===== 플레이어 조회 =====

function byId(state: GameState, id: string): Player | undefined {
  return state.players.find((p) => p.id === id);
}

function currentPlayer(state: GameState): Player {
  return state.players.find((p) => p.seat === state.turnSeat && p.alive)
    ?? state.players[0];
}

function aliveInSeatOrder(state: GameState): Player[] {
  return state.players.filter((p) => p.alive).sort((a, b) => a.seat - b.seat);
}

function nextAliveSeat(state: GameState, fromSeat: number): number {
  const alive = aliveInSeatOrder(state);
  if (alive.length === 0) return fromSeat;
  const sorted = alive.map((p) => p.seat);
  for (const s of sorted) if (s > fromSeat) return s;
  return sorted[0];
}

// ===== 피해 / 사망 / 승리 =====

function applyDamage(state: GameState, target: Player, amount: number, sourceId?: string): void {
  if (!target.alive) return;
  target.health -= amount;
  log(state, `${target.name}이(가) ${amount} 피해를 입었습니다. (체력 ${Math.max(target.health, 0)})`);

  // 맥주로 사망 회피 (생존자 3명 초과 시 자동) — MVP 단순화
  const aliveCount = state.players.filter((p) => p.alive).length;
  while (target.health <= 0 && aliveCount > 2) {
    const beer = target.hand.find((c) => c.name === 'beer');
    if (!beer) break;
    removeFromHand(target, beer.id);
    discardCard(state, beer);
    target.health += 1;
    log(state, `${target.name}이(가) 맥주로 버팁니다! (체력 ${target.health})`);
  }

  if (target.health <= 0) {
    killPlayer(state, target, sourceId);
  }
}

function killPlayer(state: GameState, target: Player, sourceId?: string): void {
  target.alive = false;
  target.health = 0;
  target.roleRevealed = true;
  log(state, `${target.name}(${roleLabel(target.role)})이(가) 사망했습니다.`);

  // 손패/장비 전부 버림
  for (const c of [...target.hand, ...target.equipment]) discardCard(state, c);
  target.hand = [];
  target.equipment = [];

  // 보상/벌칙
  const killer = sourceId ? byId(state, sourceId) : undefined;
  if (killer && killer.alive) {
    if (target.role === 'outlaw') {
      draw(state, killer, 3);
      log(state, `${killer.name}이(가) 무법자를 처치하여 카드 3장을 뽑습니다.`);
    } else if (target.role === 'deputy' && killer.role === 'sheriff') {
      for (const c of [...killer.hand, ...killer.equipment]) discardCard(state, c);
      killer.hand = [];
      killer.equipment = [];
      log(state, `보안관이 부관을 처치하여 모든 카드를 잃습니다.`);
    }
  }

  checkWin(state);
}

function checkWin(state: GameState): void {
  const sheriffAlive = state.players.some((p) => p.role === 'sheriff' && p.alive);
  const alive = state.players.filter((p) => p.alive);
  if (!sheriffAlive) {
    if (alive.length === 1 && alive[0].role === 'renegade') {
      state.winner = 'renegade';
    } else {
      state.winner = 'outlaw';
    }
    state.phase = 'over';
  } else {
    const banditsAlive = state.players.some(
      (p) => p.alive && (p.role === 'outlaw' || p.role === 'renegade'),
    );
    if (!banditsAlive) {
      state.winner = 'sheriff';
      state.phase = 'over';
    }
  }
  if (state.phase === 'over') {
    state.pending = null;
    log(state, `게임 종료! 승리: ${winnerLabel(state.winner!)}`);
  }
}

function roleLabel(role: Role): string {
  return { sheriff: '보안관', deputy: '부관', outlaw: '무법자', renegade: '배신자' }[role];
}
function winnerLabel(w: Role): string {
  if (w === 'sheriff') return '보안관과 부관';
  if (w === 'outlaw') return '무법자';
  return '배신자';
}

// ===== 턴 시작 (다이너마이트/감옥/뽑기) =====

function beginTurn(state: GameState): void {
  if (state.phase === 'over') return;
  state.bangsPlayedThisTurn = 0;
  const p = currentPlayer(state);

  // 다이너마이트
  const dyn = p.equipment.find((c) => c.name === 'dynamite');
  if (dyn) {
    const card = drawBang(state);
    if (card && isDynamiteExplosion(card)) {
      p.equipment = p.equipment.filter((c) => c.id !== dyn.id);
      discardCard(state, dyn);
      log(state, `${p.name}의 다이너마이트가 폭발합니다! (${card.rank}♠)`);
      applyDamage(state, p, 3);
      if (!p.alive) { advanceTurn(state); return; }
    } else {
      // 왼쪽(다음 생존자)에게 넘김
      p.equipment = p.equipment.filter((c) => c.id !== dyn.id);
      const nextSeat = nextAliveSeat(state, p.seat);
      const nextP = state.players.find((pl) => pl.seat === nextSeat)!;
      nextP.equipment.push(dyn);
      log(state, `${p.name}의 다이너마이트가 ${nextP.name}에게 넘어갑니다.`);
    }
  }

  // 감옥
  const jail = p.equipment.find((c) => c.name === 'jail');
  if (jail) {
    p.equipment = p.equipment.filter((c) => c.id !== jail.id);
    discardCard(state, jail);
    const card = drawBang(state);
    if (card && isHeart(card)) {
      log(state, `${p.name}이(가) 감옥에서 탈출했습니다! (${card.rank}♥)`);
    } else {
      log(state, `${p.name}이(가) 감옥에 갇혀 이번 턴을 건너뜁니다.`);
      advanceTurn(state);
      return;
    }
  }

  // 카드 2장 뽑기
  draw(state, p, 2);
  log(state, `${p.name}의 턴: 카드 2장을 뽑았습니다.`);
}

function advanceTurn(state: GameState): void {
  if (state.phase === 'over') return;
  const cur = state.players.find((p) => p.seat === state.turnSeat);
  const fromSeat = cur ? cur.seat : state.turnSeat;
  state.turnSeat = nextAliveSeat(state, fromSeat);
  beginTurn(state);
}

// ===== 액션 처리 =====

export function applyAction(state: GameState, action: GameAction): GameState {
  if (action.type === 'restart') return state; // 재시작은 서버에서 새 게임 생성으로 처리
  if (state.phase === 'over') return state;

  switch (action.type) {
    case 'playCard':
      handlePlayCard(state, action.playerId, action.cardId, action.targetId, action.targetCardId);
      break;
    case 'respond':
      handleRespond(state, action.playerId, action.cardId);
      break;
    case 'generalStorePick':
      handleGeneralStorePick(state, action.playerId, action.cardId);
      break;
    case 'discard':
      handleDiscard(state, action.playerId, action.cardId);
      break;
    case 'endTurn':
      handleEndTurn(state, action.playerId);
      break;
  }
  return state;
}

function isCurrent(state: GameState, playerId: string): boolean {
  return currentPlayer(state).id === playerId && !state.pending;
}

// ----- 카드 플레이 -----

function handlePlayCard(
  state: GameState,
  playerId: string,
  cardId: string,
  targetId?: string,
  targetCardId?: string,
): void {
  if (!isCurrent(state, playerId)) return;
  const p = currentPlayer(state);
  const card = p.hand.find((c) => c.id === cardId);
  if (!card) return;
  const def = CARD_DEFS[card.name];

  // 파란 카드(장비)
  if (def.category === 'blue') {
    playBlueCard(state, p, card, targetId);
    return;
  }

  // 갈색 카드
  switch (card.name) {
    case 'bang': playBang(state, p, card, targetId); break;
    case 'beer': playBeer(state, p, card); break;
    case 'saloon': playSaloon(state, p, card); break;
    case 'stagecoach': playDrawCards(state, p, card, 2); break;
    case 'wellsFargo': playDrawCards(state, p, card, 3); break;
    case 'panic': playPanic(state, p, card, targetId, targetCardId); break;
    case 'catBalou': playCatBalou(state, p, card, targetId, targetCardId); break;
    case 'gatling': playGatling(state, p, card); break;
    case 'indians': playIndians(state, p, card); break;
    case 'duel': playDuel(state, p, card, targetId); break;
    case 'generalStore': playGeneralStore(state, p, card); break;
    case 'missed': /* 능동적으로 낼 수 없음 */ break;
  }
}

function playBlueCard(state: GameState, p: Player, card: Card, targetId?: string): void {
  if (card.name === 'jail') {
    const target = targetId ? byId(state, targetId) : undefined;
    if (!target || !target.alive || target.id === p.id) return;
    if (target.role === 'sheriff') return; // 보안관은 감금 불가
    if (hasEquipment(target, 'jail')) return;
    removeFromHand(p, card.id);
    target.equipment.push(card);
    log(state, `${p.name}이(가) ${target.name}을(를) 감옥에 가둡니다.`);
    return;
  }

  // 자기 앞에 깔리는 카드: 무기 / 머스탱 / 조준경 / 나무통 / 다이너마이트
  if (isWeapon(card.name)) {
    // 기존 무기 교체
    const old = p.equipment.find((c) => isWeapon(c.name));
    if (old) {
      p.equipment = p.equipment.filter((c) => c.id !== old.id);
      discardCard(state, old);
    }
    removeFromHand(p, card.id);
    p.equipment.push(card);
    log(state, `${p.name}이(가) ${CARD_DEFS[card.name].label}을(를) 장착합니다.`);
    return;
  }

  // 중복 불가 장비
  if (hasEquipment(p, card.name)) return;
  removeFromHand(p, card.id);
  p.equipment.push(card);
  log(state, `${p.name}이(가) ${CARD_DEFS[card.name].label}을(를) 놓습니다.`);
}

function playBang(state: GameState, p: Player, card: Card, targetId?: string): void {
  const target = targetId ? byId(state, targetId) : undefined;
  if (!target || !target.alive || target.id === p.id) return;
  if (!inWeaponRange(state, p, target)) return;

  const volcanic = p.equipment.some((c) => c.name === 'volcanic');
  if (!volcanic && state.bangsPlayedThisTurn >= 1) return; // 한 턴 1회 제한

  removeFromHand(p, card.id);
  discardCard(state, card);
  state.bangsPlayedThisTurn += 1;
  log(state, `${p.name}이(가) ${target.name}에게 뱅!을 발사합니다.`);
  startBang(state, p.id, target.id, 1);
}

/** 단일 대상 뱅 해소: 나무통 자동 처리 후 필요 시 pending 설정 */
function startBang(state: GameState, sourceId: string, targetId: string, misses: number): void {
  const target = byId(state, targetId)!;
  let need = misses;

  // 나무통 자동 뽑기
  if (hasEquipment(target, 'barrel') && need > 0) {
    const c = drawBang(state);
    if (c && isHeart(c)) {
      need -= 1;
      log(state, `${target.name}의 나무통이 발동! (${c.rank}♥) 빗나감 효과.`);
    }
  }

  if (need <= 0) {
    log(state, `${target.name}이(가) 공격을 피했습니다.`);
    return;
  }
  state.pending = { kind: 'bang', targetId, sourceId, missesNeeded: need, barrelUsed: true };
}

function playBeer(state: GameState, p: Player, card: Card): void {
  const aliveCount = state.players.filter((pl) => pl.alive).length;
  if (aliveCount <= 2) return; // 마지막 2인전에서는 효과 없음
  if (p.health >= p.maxHealth) return;
  removeFromHand(p, card.id);
  discardCard(state, card);
  p.health += 1;
  log(state, `${p.name}이(가) 맥주로 체력을 1 회복합니다. (체력 ${p.health})`);
}

function playSaloon(state: GameState, p: Player, card: Card): void {
  removeFromHand(p, card.id);
  discardCard(state, card);
  for (const pl of state.players) {
    if (pl.alive && pl.health < pl.maxHealth) pl.health += 1;
  }
  log(state, `${p.name}이(가) 술집을 열어 모두가 체력을 1 회복합니다.`);
}

function playDrawCards(state: GameState, p: Player, card: Card, n: number): void {
  removeFromHand(p, card.id);
  discardCard(state, card);
  draw(state, p, n);
  log(state, `${p.name}이(가) ${CARD_DEFS[card.name].label}(으)로 ${n}장을 뽑습니다.`);
}

function playPanic(state: GameState, p: Player, card: Card, targetId?: string, targetCardId?: string): void {
  const target = targetId ? byId(state, targetId) : undefined;
  if (!target || !target.alive || target.id === p.id) return;
  if (distance(state, p, target) > 1) return;
  const stolen = takeCardFrom(state, target, targetCardId);
  if (!stolen) return;
  removeFromHand(p, card.id);
  discardCard(state, card);
  p.hand.push(stolen);
  log(state, `${p.name}이(가) ${target.name}의 카드를 빼앗습니다.`);
}

function playCatBalou(state: GameState, p: Player, card: Card, targetId?: string, targetCardId?: string): void {
  const target = targetId ? byId(state, targetId) : undefined;
  if (!target || !target.alive || target.id === p.id) return;
  const removed = takeCardFrom(state, target, targetCardId);
  if (!removed) return;
  removeFromHand(p, card.id);
  discardCard(state, card);
  discardCard(state, removed);
  log(state, `${p.name}이(가) ${target.name}의 카드를 버리게 합니다.`);
}

/** 손패 또는 장비에서 카드 1장 가져오기 (id 지정 없으면 손패 무작위 1장) */
function takeCardFrom(state: GameState, target: Player, cardId?: string): Card | null {
  if (cardId) {
    const hi = target.hand.findIndex((c) => c.id === cardId);
    if (hi >= 0) return target.hand.splice(hi, 1)[0];
    const ei = target.equipment.findIndex((c) => c.id === cardId);
    if (ei >= 0) return target.equipment.splice(ei, 1)[0];
    return null;
  }
  if (target.hand.length > 0) {
    return target.hand.splice(Math.floor(nextRand(state) * target.hand.length), 1)[0];
  }
  if (target.equipment.length > 0) return target.equipment.splice(0, 1)[0];
  return null;
}

function playGatling(state: GameState, p: Player, card: Card): void {
  removeFromHand(p, card.id);
  discardCard(state, card);
  log(state, `${p.name}이(가) 개틀링을 발사합니다!`);
  const remaining = aliveInSeatOrder(state).filter((pl) => pl.id !== p.id).map((pl) => pl.id);
  state.pending = { kind: 'gatling', sourceId: p.id, remaining };
  advanceGatling(state);
}

function advanceGatling(state: GameState): void {
  const pend = state.pending;
  if (!pend || pend.kind !== 'gatling') return;
  while (pend.remaining.length > 0) {
    const target = byId(state, pend.remaining[0]);
    if (!target || !target.alive) { pend.remaining.shift(); continue; }
    // 나무통 자동
    if (hasEquipment(target, 'barrel')) {
      const c = drawBang(state);
      if (c && isHeart(c)) {
        log(state, `${target.name}의 나무통이 개틀링을 막았습니다! (${c.rank}♥)`);
        pend.remaining.shift();
        continue;
      }
    }
    // 이 대상의 응답 대기
    return;
  }
  // 모두 처리됨
  state.pending = null;
}

function playIndians(state: GameState, p: Player, card: Card): void {
  removeFromHand(p, card.id);
  discardCard(state, card);
  log(state, `${p.name}이(가) 인디언의 습격을 일으킵니다!`);
  const remaining = aliveInSeatOrder(state).filter((pl) => pl.id !== p.id).map((pl) => pl.id);
  state.pending = { kind: 'indians', sourceId: p.id, remaining };
  advanceIndians(state);
}

function advanceIndians(state: GameState): void {
  const pend = state.pending;
  if (!pend || pend.kind !== 'indians') return;
  while (pend.remaining.length > 0) {
    const target = byId(state, pend.remaining[0]);
    if (!target || !target.alive) { pend.remaining.shift(); continue; }
    return; // 응답 대기
  }
  state.pending = null;
}

function playDuel(state: GameState, p: Player, card: Card, targetId?: string): void {
  const target = targetId ? byId(state, targetId) : undefined;
  if (!target || !target.alive || target.id === p.id) return;
  removeFromHand(p, card.id);
  discardCard(state, card);
  log(state, `${p.name}이(가) ${target.name}에게 결투를 신청합니다!`);
  // 결투를 받은 쪽(target)이 먼저 뱅!을 내야 함
  state.pending = { kind: 'duel', currentId: target.id, otherId: p.id };
}

function playGeneralStore(state: GameState, p: Player, card: Card): void {
  removeFromHand(p, card.id);
  discardCard(state, card);
  const alive = aliveInSeatOrder(state);
  const revealed: Card[] = [];
  for (let i = 0; i < alive.length; i++) {
    const c = drawOne(state);
    if (c) revealed.push(c);
  }
  // 현재 플레이어부터 좌석 순서
  const startIdx = alive.findIndex((pl) => pl.id === p.id);
  const order = alive.slice(startIdx).concat(alive.slice(0, startIdx)).map((pl) => pl.id);
  log(state, `${p.name}이(가) 잡화점을 엽니다. (${revealed.length}장)`);
  state.pending = { kind: 'generalStore', order, revealed };
}

// ----- 응답 처리 -----

function handleRespond(state: GameState, playerId: string, cardId?: string): void {
  const pend = state.pending;
  if (!pend) return;

  if (pend.kind === 'bang') {
    if (playerId !== pend.targetId) return;
    const target = byId(state, pend.targetId)!;
    if (cardId) {
      const c = target.hand.find((x) => x.id === cardId);
      if (!c || c.name !== 'missed') return;
      removeFromHand(target, c.id);
      discardCard(state, c);
      pend.missesNeeded -= 1;
      log(state, `${target.name}이(가) 빗나감!으로 막습니다.`);
      if (pend.missesNeeded <= 0) { state.pending = null; }
      return;
    }
    // 응답 포기 -> 피해
    state.pending = null;
    applyDamage(state, target, 1, pend.sourceId);
    return;
  }

  if (pend.kind === 'gatling') {
    if (playerId !== pend.remaining[0]) return;
    const target = byId(state, playerId)!;
    if (cardId) {
      const c = target.hand.find((x) => x.id === cardId);
      if (!c || c.name !== 'missed') return;
      removeFromHand(target, c.id);
      discardCard(state, c);
      log(state, `${target.name}이(가) 빗나감!으로 개틀링을 피합니다.`);
    } else {
      applyDamage(state, target, 1, pend.sourceId);
    }
    pend.remaining.shift();
    if (state.phase !== 'over') advanceGatling(state);
    return;
  }

  if (pend.kind === 'indians') {
    if (playerId !== pend.remaining[0]) return;
    const target = byId(state, playerId)!;
    if (cardId) {
      const c = target.hand.find((x) => x.id === cardId);
      if (!c || c.name !== 'bang') return;
      removeFromHand(target, c.id);
      discardCard(state, c);
      log(state, `${target.name}이(가) 뱅!을 버려 인디언을 막습니다.`);
    } else {
      applyDamage(state, target, 1, pend.sourceId);
    }
    pend.remaining.shift();
    if (state.phase !== 'over') advanceIndians(state);
    return;
  }

  if (pend.kind === 'duel') {
    if (playerId !== pend.currentId) return;
    const cur = byId(state, pend.currentId)!;
    if (cardId) {
      const c = cur.hand.find((x) => x.id === cardId);
      if (!c || c.name !== 'bang') return;
      removeFromHand(cur, c.id);
      discardCard(state, c);
      log(state, `${cur.name}이(가) 결투에서 뱅!을 냅니다.`);
      // 역할 교대
      state.pending = { kind: 'duel', currentId: pend.otherId, otherId: pend.currentId };
    } else {
      // 못 냄 -> 패배
      const other = byId(state, pend.otherId)!;
      state.pending = null;
      log(state, `${cur.name}이(가) 결투에서 패배합니다.`);
      applyDamage(state, cur, 1, other.id);
    }
    return;
  }
}

function handleGeneralStorePick(state: GameState, playerId: string, cardId: string): void {
  const pend = state.pending;
  if (!pend || pend.kind !== 'generalStore') return;
  if (pend.order[0] !== playerId) return;
  const idx = pend.revealed.findIndex((c) => c.id === cardId);
  if (idx < 0) return;
  const card = pend.revealed.splice(idx, 1)[0];
  const p = byId(state, playerId)!;
  p.hand.push(card);
  log(state, `${p.name}이(가) 잡화점에서 ${CARD_DEFS[card.name].label}을(를) 가져갑니다.`);
  pend.order.shift();
  // 마지막 한 명은 남은 한 장을 자동으로
  if (pend.order.length === 1 && pend.revealed.length === 1) {
    const last = byId(state, pend.order[0])!;
    last.hand.push(pend.revealed[0]);
    log(state, `${last.name}이(가) 남은 카드를 가져갑니다.`);
    state.pending = null;
    return;
  }
  if (pend.order.length === 0 || pend.revealed.length === 0) {
    state.pending = null;
  }
}

function handleDiscard(state: GameState, playerId: string, cardId: string): void {
  if (!isCurrent(state, playerId)) return;
  const p = currentPlayer(state);
  const c = removeFromHand(p, cardId);
  if (!c) return;
  discardCard(state, c);
  log(state, `${p.name}이(가) 카드를 버립니다.`);
}

function handleEndTurn(state: GameState, playerId: string): void {
  if (!isCurrent(state, playerId)) return;
  const p = currentPlayer(state);
  if (p.hand.length > p.health) {
    // 손패 초과: 버려야 함 (클라이언트가 discard 유도)
    return;
  }
  log(state, `${p.name}이(가) 턴을 마칩니다.`);
  advanceTurn(state);
}

// 외부 노출용 헬퍼
export { byId, currentPlayer, nameOf };
