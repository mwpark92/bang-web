// ===== 카드 기본 속성 =====

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank =
  | 'A' | '2' | '3' | '4' | '5' | '6' | '7'
  | '8' | '9' | '10' | 'J' | 'Q' | 'K';

/** 베이스 게임의 모든 카드 이름 */
export type CardName =
  // 갈색(브라운) — 사용 후 버림
  | 'bang' | 'missed' | 'beer' | 'saloon' | 'stagecoach' | 'wellsFargo'
  | 'indians' | 'gatling' | 'duel' | 'generalStore' | 'panic' | 'catBalou'
  // 무기 (파란색, 장비)
  | 'volcanic' | 'schofield' | 'remington' | 'carbine' | 'winchester'
  // 기타 장비 (파란색)
  | 'mustang' | 'scope' | 'barrel' | 'jail' | 'dynamite';

/** 카드 인스턴스 */
export interface Card {
  id: string;
  name: CardName;
  suit: Suit;
  rank: Rank;
}

// ===== 역할 =====

export type Role = 'sheriff' | 'deputy' | 'outlaw' | 'renegade';

// ===== 플레이어 =====

export interface Player {
  id: string;            // 재접속에도 유지되는 안정적 ID
  name: string;
  seat: number;          // 0..n-1 좌석 순서
  role: Role;
  roleRevealed: boolean; // 보안관은 항상 공개, 나머지는 사망 시 공개
  maxHealth: number;
  health: number;
  alive: boolean;
  hand: Card[];          // 비공개 (본인만)
  equipment: Card[];     // 앞에 깔린 파란 카드(무기/머스탱/조준경/통/감옥/다이너마이트)
}

// ===== 진행 대기 상태 (반응 시스템) =====

/** 게임이 특정 플레이어(들)의 응답을 기다리는 상태 */
export type Pending =
  // Bang!/개틀링 단일 대상: 대상이 Missed!로 막거나 피해
  | { kind: 'bang'; targetId: string; sourceId: string; missesNeeded: number; barrelUsed: boolean }
  // 개틀링: 시전자 제외 전원이 순차로 Missed! 응답
  | { kind: 'gatling'; sourceId: string; remaining: string[] }
  // 인디언: 시전자 제외 전원이 순차로 Bang!을 버리거나 피해
  | { kind: 'indians'; sourceId: string; remaining: string[] }
  // 결투: 두 사람이 번갈아 Bang!을 내며, 못 내면 패배(피해)
  | { kind: 'duel'; currentId: string; otherId: string }
  // 잡화점: 펼쳐진 카드 중 순서대로 한 장씩 고름
  | { kind: 'generalStore'; order: string[]; revealed: Card[] };

// ===== 게임 상태 =====

export type GamePhase = 'playing' | 'over';

export interface LogEntry {
  id: number;
  text: string;        // 한국어 로그 메시지
}

export interface GameState {
  players: Player[];
  deck: Card[];          // 뽑는 더미 (끝에서 pop)
  discard: Card[];       // 버린 더미 (마지막이 맨 위)
  turnSeat: number;      // 현재 턴 플레이어의 seat
  phase: GamePhase;
  pending: Pending | null;
  winner: Role | null;   // 'sheriff'(보안관+부관) | 'outlaw' | 'renegade'
  log: LogEntry[];
  rng: number;           // mulberry32 상태값
  logSeq: number;        // 로그 id 시퀀스
  /** 이번 턴에 낸 Bang! 횟수 (볼캐닉/무기 제한용) */
  bangsPlayedThisTurn: number;
}

// ===== 클라이언트 액션 =====

export type GameAction =
  | { type: 'playCard'; playerId: string; cardId: string; targetId?: string; targetCardId?: string }
  | { type: 'respond'; playerId: string; cardId?: string }      // cardId 없으면 응답 포기
  | { type: 'endTurn'; playerId: string }
  | { type: 'discard'; playerId: string; cardId: string }
  | { type: 'generalStorePick'; playerId: string; cardId: string }
  | { type: 'restart'; playerId: string };

// ===== 클라이언트로 보내는 (가려진) 뷰 =====

/** 다른 플레이어는 손패 내용을 숨기고 매수만 노출 */
export interface PublicPlayer {
  id: string;
  name: string;
  seat: number;
  role: Role | null;     // 보안관/사망자만 공개, 그 외 null
  isYou: boolean;
  maxHealth: number;
  health: number;
  alive: boolean;
  handCount: number;
  hand: Card[] | null;   // 본인만 채워짐
  equipment: Card[];
  weaponRange: number;   // 현재 무기 사거리 (기본 1)
}

export interface ClientView {
  you: string;                 // 내 playerId
  players: PublicPlayer[];
  deckCount: number;
  discardTop: Card | null;
  discardCount: number;
  turnSeat: number;
  phase: GamePhase;
  pending: Pending | null;
  winner: Role | null;
  log: LogEntry[];
  /** 내가 지금 할 수 있는 행동 힌트 */
  yourTurn: boolean;
  awaitingYourResponse: boolean;
}
