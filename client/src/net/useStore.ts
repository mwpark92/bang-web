import { useSyncExternalStore } from 'react';
import { store, type AppState } from './socket.js';

export function useAppState(): AppState {
  return useSyncExternalStore(store.subscribe, store.getState);
}

export { store };
