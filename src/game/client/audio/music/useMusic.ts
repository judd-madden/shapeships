import { useEffect } from 'react';
import { getMusicController } from './musicController';
import type { MusicGameInfo, MusicScene } from './musicTrackRule';

export function useMusicScene(scene: MusicScene, gameId: string | null): void {
  useEffect(() => {
    getMusicController().reportScene(scene, gameId);
  }, [scene, gameId]);
}

export function useMusicGame(gameId: string, info: MusicGameInfo | null): void {
  const role = info?.role ?? null;
  const left = info?.role === 'player' ? info.species : info?.left ?? null;
  const right = info?.role === 'spectator' ? info.right : null;
  useEffect(() => getMusicController().reportGame(gameId,
    role === 'player' ? { role, species: left } : role === 'spectator' ? { role, left, right } : null
  ), [gameId, role, left, right]);
}
