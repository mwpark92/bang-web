import type { Card, CardName, Rank, Suit } from './types.js';

export type CardCategory = 'brown' | 'blue';

export interface CardDef {
  name: CardName;
  label: string;            // 한국어 카드명
  category: CardCategory;   // brown = 사용 후 버림, blue = 앞에 깔림
  weaponRange?: number;     // 무기 사거리
  desc: string;             // 한국어 설명
}

export const CARD_DEFS: Record<CardName, CardDef> = {
  bang:        { name: 'bang', label: '뱅!', category: 'brown', desc: '사거리 내 다른 플레이어 1명에게 1 피해. 한 턴에 한 번만(무기 제한).' },
  missed:      { name: 'missed', label: '빗나감!', category: 'brown', desc: '나를 겨눈 뱅!을 무효화한다.' },
  beer:        { name: 'beer', label: '맥주', category: 'brown', desc: '체력을 1 회복한다. 마지막 2인 결투에서는 효과 없음.' },
  saloon:      { name: 'saloon', label: '술집', category: 'brown', desc: '살아있는 모든 플레이어가 체력을 1 회복한다.' },
  stagecoach:  { name: 'stagecoach', label: '역마차', category: 'brown', desc: '카드 2장을 뽑는다.' },
  wellsFargo:  { name: 'wellsFargo', label: '웰스파고', category: 'brown', desc: '카드 3장을 뽑는다.' },
  indians:     { name: 'indians', label: '인디언의 습격', category: 'brown', desc: '나를 제외한 모두는 뱅!을 버리거나 1 피해를 받는다.' },
  gatling:     { name: 'gatling', label: '개틀링', category: 'brown', desc: '나를 제외한 모두에게 뱅!을 발사한다.' },
  duel:        { name: 'duel', label: '결투', category: 'brown', desc: '대상과 번갈아 뱅!을 낸다. 먼저 못 내는 쪽이 1 피해.' },
  generalStore:{ name: 'generalStore', label: '잡화점', category: 'brown', desc: '인원수만큼 카드를 펼치고 순서대로 한 장씩 가져간다.' },
  panic:       { name: 'panic', label: '약탈', category: 'brown', desc: '거리 1 이내 플레이어의 카드 1장을 빼앗는다.' },
  catBalou:    { name: 'catBalou', label: '캣 발루', category: 'brown', desc: '임의의 플레이어 카드 1장을 버리게 한다.' },

  volcanic:    { name: 'volcanic', label: '볼캐닉', category: 'blue', weaponRange: 1, desc: '사거리 1. 한 턴에 뱅!을 여러 번 낼 수 있다.' },
  schofield:   { name: 'schofield', label: '스코필드', category: 'blue', weaponRange: 2, desc: '사거리 2 무기.' },
  remington:   { name: 'remington', label: '레밍턴', category: 'blue', weaponRange: 3, desc: '사거리 3 무기.' },
  carbine:     { name: 'carbine', label: '카빈총', category: 'blue', weaponRange: 4, desc: '사거리 4 무기.' },
  winchester:  { name: 'winchester', label: '윈체스터', category: 'blue', weaponRange: 5, desc: '사거리 5 무기.' },

  mustang:     { name: 'mustang', label: '머스탱', category: 'blue', desc: '다른 사람이 보는 나와의 거리가 1 늘어난다.' },
  scope:       { name: 'scope', label: '조준경', category: 'blue', desc: '내가 보는 다른 사람과의 거리가 1 줄어든다.' },
  barrel:      { name: 'barrel', label: '나무통', category: 'blue', desc: '뱅!을 맞을 때 뽑기로 하트가 나오면 빗나감! 효과.' },
  jail:        { name: 'jail', label: '감옥', category: 'blue', desc: '대상에게 채운다. 자기 턴에 뽑기로 하트가 나와야 행동 가능.' },
  dynamite:    { name: 'dynamite', label: '다이너마이트', category: 'blue', desc: '매 턴 뽑기로 스페이드 2~9면 폭발해 3 피해. 아니면 옆으로 넘어간다.' },
};

/** 무기 사거리 (무기 없으면 1) */
export function weaponRangeOf(name: CardName): number {
  return CARD_DEFS[name].weaponRange ?? 0;
}

export function isWeapon(name: CardName): boolean {
  return CARD_DEFS[name].weaponRange !== undefined;
}

// ===== 베이스 덱 구성 (실제 게임 매수에 근접) =====

const DECK_COMPOSITION: Array<[CardName, number]> = [
  ['bang', 25], ['missed', 12], ['beer', 6], ['panic', 4],
  ['generalStore', 2], ['indians', 2], ['duel', 3], ['gatling', 1],
  ['catBalou', 4], ['stagecoach', 2], ['wellsFargo', 1], ['saloon', 1],
  ['volcanic', 2], ['schofield', 3], ['remington', 1], ['carbine', 1],
  ['winchester', 1], ['mustang', 2], ['scope', 1], ['barrel', 2],
  ['jail', 3], ['dynamite', 1],
];

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/**
 * 미정렬 덱을 생성한다. 각 카드에 고유 id와 (다양성 위해 순환 분배한) suit/rank를 부여한다.
 * 셔플은 호출 측(엔진)에서 RNG로 수행한다.
 */
export function buildDeck(): Card[] {
  const cards: Card[] = [];
  let seq = 0;
  for (const [name, count] of DECK_COMPOSITION) {
    for (let i = 0; i < count; i++) {
      const suit = SUITS[seq % SUITS.length];
      const rank = RANKS[Math.floor(seq / SUITS.length) % RANKS.length];
      cards.push({ id: `c${seq}`, name, suit, rank });
      seq++;
    }
  }
  return cards;
}

/** 뽑기(draw!) 판정: 하트면 true (나무통/감옥용) */
export function isHeart(card: Card): boolean {
  return card.suit === 'hearts';
}

/** 다이너마이트 폭발 판정: 스페이드 2~9 */
export function isDynamiteExplosion(card: Card): boolean {
  if (card.suit !== 'spades') return false;
  const n = Number(card.rank);
  return n >= 2 && n <= 9;
}
