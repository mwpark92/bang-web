import type { Role, Suit } from 'shared';

export const ROLE_LABEL: Record<Role, string> = {
  sheriff: '보안관',
  deputy: '부관',
  outlaw: '무법자',
  renegade: '배신자',
};

export const ROLE_GOAL: Record<Role, string> = {
  sheriff: '모든 무법자와 배신자를 제거하세요.',
  deputy: '보안관을 도와 무법자와 배신자를 제거하세요.',
  outlaw: '보안관을 처치하세요.',
  renegade: '마지막 한 명이 되어 살아남으세요.',
};

export const SUIT_SYMBOL: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

export const SUIT_RED: Record<Suit, boolean> = {
  hearts: true,
  diamonds: true,
  clubs: false,
  spades: false,
};

export function winnerLabel(w: Role): string {
  if (w === 'sheriff') return '보안관과 부관 승리!';
  if (w === 'outlaw') return '무법자 승리!';
  return '배신자 승리!';
}
