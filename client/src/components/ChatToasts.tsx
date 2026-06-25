import { useEffect, useRef, useState } from 'react';
import { useAppState } from '../net/useStore.js';
import type { ChatMessage } from '../net/types.js';

const VISIBLE_MS = 5000;

/** 게임 중 새 채팅을 화면에 잠깐 띄웠다가 사라지게 함 */
export function ChatToasts() {
  const { chat } = useAppState();
  const [shown, setShown] = useState<ChatMessage[]>([]);
  const lastIdRef = useRef<number>(0);

  // 초기 마운트 시 기존 메시지는 토스트로 띄우지 않음
  useEffect(() => {
    if (lastIdRef.current === 0 && chat.length > 0) {
      lastIdRef.current = chat[chat.length - 1].id;
    }
  }, [chat]);

  useEffect(() => {
    const fresh = chat.filter((m) => m.id > lastIdRef.current);
    if (fresh.length === 0) return;
    lastIdRef.current = chat[chat.length - 1].id;
    setShown((prev) => [...prev, ...fresh]);
    const timers = fresh.map((m) =>
      setTimeout(() => setShown((prev) => prev.filter((x) => x.id !== m.id)), VISIBLE_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [chat]);

  if (shown.length === 0) return null;
  return (
    <div className="chat-toasts">
      {shown.slice(-4).map((m) => (
        <div key={m.id} className="chat-toast">
          <span className="chat-name">{m.name}</span>
          <span className="chat-text">{m.text}</span>
        </div>
      ))}
    </div>
  );
}
