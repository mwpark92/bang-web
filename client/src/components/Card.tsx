import type { MouseEvent } from 'react';
import { CARD_DEFS, type Card as CardT } from 'shared';
import { SUIT_RED, SUIT_SYMBOL } from '../i18n/ko.js';

interface Props {
  card: CardT;
  onClick?: (e: MouseEvent) => void;
  selected?: boolean;
  disabled?: boolean;
  small?: boolean;
}

export function Card({ card, onClick, selected, disabled, small }: Props) {
  const def = CARD_DEFS[card.name];
  const red = SUIT_RED[card.suit];
  return (
    <button
      className={`card ${def.category} ${selected ? 'selected' : ''} ${small ? 'small' : ''}`}
      disabled={disabled}
      onClick={onClick}
      title={def.desc}
    >
      <span className={`corner ${red ? 'red' : 'black'}`}>
        {card.rank}
        {SUIT_SYMBOL[card.suit]}
      </span>
      <span className="card-label">{def.label}</span>
    </button>
  );
}

/** 뒷면(상대 손패용) */
export function CardBack({ small }: { small?: boolean }) {
  return <div className={`card back ${small ? 'small' : ''}`} />;
}
