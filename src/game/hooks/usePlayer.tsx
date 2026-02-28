import { useState, useEffect } from 'react';

export interface Player {
  id: string;
  name: string;
  isSpectator: boolean;
}

export function usePlayer() {
  const [player, setPlayer] = useState<Player | null>(null);

  useEffect(() => {
    // Initialize player from session storage or create new one
    initializePlayer();
  }, []);

  const initializePlayer = () => {
    const storedId = sessionStorage.getItem('shapeships-player-id');
    const storedName = sessionStorage.getItem('shapeships-player-name');
    const storedSpectator = sessionStorage.getItem('shapeships-is-spectator');

    if (storedId && storedName) {
      setPlayer({
        id: storedId,
        name: storedName,
        isSpectator: storedSpectator === 'true'
      });
    } else {
      createNewPlayer();
    }
  };

  const createNewPlayer = (isSpectator: boolean = false) => {
    // Generate unique player ID
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    const playerId = `player_${timestamp}_${random}`;

    // Generate random player name
    const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];
    const adjectives = ['Swift', 'Brave', 'Clever', 'Bold', 'Quick', 'Smart', 'Sharp', 'Keen'];
    
    const randomName = names[Math.floor(Math.random() * names.length)];
    const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const playerName = `${randomAdj} ${randomName}`;

    const newPlayer = {
      id: playerId,
      name: playerName,
      isSpectator
    };

    // Store in session storage
    sessionStorage.setItem('shapeships-player-id', playerId);
    sessionStorage.setItem('shapeships-player-name', playerName);
    sessionStorage.setItem('shapeships-is-spectator', isSpectator.toString());

    setPlayer(newPlayer);
    return newPlayer;
  };

  const updatePlayerName = (newName: string) => {
    if (player) {
      // Player exists, update it
      const updatedPlayer = { ...player, name: newName };
      setPlayer(updatedPlayer);
      sessionStorage.setItem('shapeships-player-name', newName);
      console.log('👤 [usePlayer] Updated existing player name:', newName);
    } else {
      // Player doesn't exist, create minimal player object
      // ID will be session-derived in future, for now use temp client ID
      const existingId = sessionStorage.getItem('shapeships-player-id');
      const playerId = existingId || `player_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
      
      const newPlayer = {
        id: playerId,
        name: newName,
        isSpectator: false
      };
      
      // Store in session storage
      sessionStorage.setItem('shapeships-player-id', playerId);
      sessionStorage.setItem('shapeships-player-name', newName);
      sessionStorage.setItem('shapeships-is-spectator', 'false');
      
      setPlayer(newPlayer);
      console.log('👤 [usePlayer] Created new player:', { id: playerId, name: newName });
    }
  };

  const toggleSpectatorMode = () => {
    if (player) {
      const updatedPlayer = { ...player, isSpectator: !player.isSpectator };
      setPlayer(updatedPlayer);
      sessionStorage.setItem('shapeships-is-spectator', updatedPlayer.isSpectator.toString());
    }
  };

  const clearPlayer = () => {
    sessionStorage.removeItem('shapeships-player-id');
    sessionStorage.removeItem('shapeships-player-name');
    sessionStorage.removeItem('shapeships-is-spectator');
    setPlayer(null);
    console.log('🗑️ [usePlayer] Player cleared from session storage');
  };

  return {
    player,
    createNewPlayer,
    updatePlayerName,
    toggleSpectatorMode,
    clearPlayer,
    isReady: player !== null
  };
}