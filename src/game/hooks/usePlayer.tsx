import { useState, useEffect, useCallback } from 'react';
import type { AccountState } from '../client/account/types';
import { getPlayerName } from '../client/gameSession/playerName';

export interface Player {
  id: string;
  name: string;
  isSpectator: boolean;
}

export function usePlayer(account?: AccountState) {
  const [storedPlayer, setPlayer] = useState<Player | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const storedId = sessionStorage.getItem('shapeships-player-id');
    const storedName = sessionStorage.getItem('shapeships-player-name');
    const storedSpectator = sessionStorage.getItem('shapeships-is-spectator');

    if (storedId && storedName) {
      setPlayer({
        id: storedId,
        name: storedName,
        isSpectator: storedSpectator === 'true'
      });
    }
    setIsInitialized(true);
  }, []);

  const updatePlayerName = useCallback((newName: string) => {
    if (!newName.trim()) return;
    setPlayer((previous) => {
      // This local ID is presentation bookkeeping; game identity remains session-derived.
      const existingId = sessionStorage.getItem('shapeships-player-id');
      const playerId = previous?.id || existingId || `player_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
      
      const newPlayer = {
        id: playerId,
        name: newName,
        isSpectator: previous?.isSpectator ?? false
      };
      
      // Store in session storage
      sessionStorage.setItem('shapeships-player-id', playerId);
      sessionStorage.setItem('shapeships-player-name', newName);
      sessionStorage.setItem('shapeships-is-spectator', String(newPlayer.isSpectator));
      
      return newPlayer;
    });
  }, []);

  const toggleSpectatorMode = () => {
    if (storedPlayer) {
      const updatedPlayer = { ...storedPlayer, isSpectator: !storedPlayer.isSpectator };
      setPlayer(updatedPlayer);
      sessionStorage.setItem('shapeships-is-spectator', updatedPlayer.isSpectator.toString());
    }
  };

  const clearPlayer = useCallback(() => {
    sessionStorage.removeItem('shapeships-player-id');
    sessionStorage.removeItem('shapeships-player-name');
    sessionStorage.removeItem('shapeships-is-spectator');
    setPlayer(null);
    console.log('🗑️ [usePlayer] Player cleared from session storage');
  }, []);

  const name = getPlayerName(storedPlayer?.name ?? '', account);
  // Account names are derived from the live snapshot, never persisted as remembered identity.
  const player: Player | null = name ? {
    id: storedPlayer?.id ?? (account?.status === 'signedIn' ? account.linkedSessionId ?? '' : ''),
    name,
    isSpectator: storedPlayer?.isSpectator ?? false,
  } : null;

  return {
    player,
    updatePlayerName,
    toggleSpectatorMode,
    clearPlayer,
    isReady: isInitialized && player !== null,
    isInitialized,
  };
}
