import { useEffect, useRef, useState } from 'react';
import { store, useAppState } from '../net/useStore.js';

interface Props {
  you: string;     // 내 표시 이름 (정렬/강조용)
  className?: string;
}

export function ChatBox({ you, className }: Props) {
  const { chat } = useAppState();
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.length]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    store.sendChat(text);
    setText('');
  };

  return (
    <div className={`chatbox ${className ?? ''}`}>
      <div className="chat-list" ref={listRef}>
        {chat.length === 0 && <div className="chat-empty">아직 메시지가 없습니다.</div>}
        {chat.map((m) => (
          <div key={m.id} className={`chat-msg ${m.name === you ? 'mine' : ''}`}>
            <span className="chat-name">{m.name}</span>
            <span className="chat-text">{m.text}</span>
          </div>
        ))}
      </div>
      <form className="chat-input" onSubmit={submit}>
        <input
          value={text}
          maxLength={200}
          placeholder="메시지 입력…"
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn tiny primary" disabled={!text.trim()}>
          전송
        </button>
      </form>
    </div>
  );
}
