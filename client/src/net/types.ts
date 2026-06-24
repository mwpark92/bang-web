// 서버 RoomView와 동일한 형태 (로비 상태)
export interface LobbyPlayerView {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
}

export interface RoomView {
  code: string;
  hostId: string;
  started: boolean;
  players: LobbyPlayerView[];
  you: string;
}
