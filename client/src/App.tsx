import { useEffect } from 'react';
import { store, useAppState } from './net/useStore.js';
import { Home } from './screens/Home.js';
import { Lobby } from './screens/Lobby.js';
import { GameTable } from './screens/Game/GameTable.js';

export function App() {
  const { connected, room, view, error } = useAppState();

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => store.setError(null), 3500);
    return () => clearTimeout(t);
  }, [error]);

  let screen;
  if (!room) {
    screen = <Home />;
  } else if (!room.started || !view) {
    screen = <Lobby room={room} />;
  } else {
    screen = <GameTable room={room} view={view} />;
  }

  return (
    <div className="app">
      {!connected && <div className="conn-banner">서버에 연결 중…</div>}
      {error && <div className="toast">{error}</div>}
      {screen}
    </div>
  );
}
