import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';
import type { Player } from '../game/hooks/usePlayer';
import type { CreatePrivateGameSettings } from './panels/CreatePrivateGamePanel';
import { LoginShell } from './shells/LoginShell';
import { MenuShell } from './shells/MenuShell';

const ALPHA_DISABLE_AUTH = true;

type ShellId = 'login' | 'menu';

interface ScreenManagerProps {
  player: Player | null;
  initialShell: ShellId;
  pendingInviteGameId: string | null;
  onCreatePrivateGame: (settings: CreatePrivateGameSettings) => Promise<string>;
  onCreateComputerGame: (settings: CreatePrivateGameSettings) => Promise<string>;
  onLaunchGame: (gameId: string) => void;
  onResetPlayerSession: () => void;
  onStartSession: (displayName: string) => Promise<void>;
  onSwitchToDevMode: () => void;
}

export default function ScreenManager({
  player,
  initialShell,
  pendingInviteGameId,
  onCreatePrivateGame,
  onCreateComputerGame,
  onLaunchGame,
  onResetPlayerSession,
  onStartSession,
  onSwitchToDevMode,
}: ScreenManagerProps) {
  const [currentShell, setCurrentShell] = useState<ShellId>(initialShell);
  const [user, setUser] = useState(null);
  const [isStartingSession, setIsStartingSession] = useState(false);

  useEffect(() => {
    setCurrentShell(initialShell);
  }, [initialShell]);

  const navigateToShell = (shell: string) => {
    if (shell === 'login' || shell === 'menu') {
      setCurrentShell(shell);
    }
  };

  const handleNameSubmit = async (displayName: string) => {
    console.log('[Entry] Starting session for player:', displayName);
    setIsStartingSession(true);

    try {
      await onStartSession(displayName);

      if (pendingInviteGameId) {
        onLaunchGame(pendingInviteGameId);
        return;
      }

      setCurrentShell('menu');
    } catch (error) {
      console.error('[Entry] Failed to start session:', error);
      alert('Failed to start session. Please try again.');
    } finally {
      setIsStartingSession(false);
    }
  };

  const handleGameCreated = (gameId: string) => {
    onLaunchGame(gameId);
  };

  const handleExitToEntry = () => {
    onResetPlayerSession();
    setUser(null);
    setCurrentShell('login');
  };

  const handleSuccessfulLogin = (userData: any) => {
    setUser(userData);
    setCurrentShell('menu');
  };

  const handleLogout = () => {
    onResetPlayerSession();
    setUser(null);
    setCurrentShell('login');
  };

  const isLocalhostDevModeVisible = window.location.hostname === 'localhost';

  const renderShell = () => {
    switch (currentShell) {
      case 'menu':
        return (
          <MenuShell
            onNavigate={navigateToShell}
            onExit={handleExitToEntry}
            onLogout={handleLogout}
            onGameCreated={handleGameCreated}
            onCreatePrivateGame={onCreatePrivateGame}
            onCreateComputerGame={onCreateComputerGame}
            user={user}
            player={player}
            alphaDisableAuth={ALPHA_DISABLE_AUTH}
          />
        );
      case 'login':
      default:
        return (
          <LoginShell
            onNavigate={navigateToShell}
            onNameSubmit={handleNameSubmit}
            onLogin={handleSuccessfulLogin}
            alphaDisableAuth={ALPHA_DISABLE_AUTH}
            alphaPrimaryCtaLabel={pendingInviteGameId ? 'JOIN FRIENDS GAME' : 'PLAY'}
            isStartingSession={isStartingSession}
          />
        );
    }
  };

  return (
    <div
      className="ss-playerRoot min-h-screen relative"
    >
      {isLocalhostDevModeVisible && (
        <div className="fixed top-4 right-4 z-50">
          <Button
            variant="outline"
            size="sm"
            onClick={onSwitchToDevMode}
            disabled={isStartingSession}
            className="bg-shapeships-grey-90 shadow-md text-shapeships-grey-50 hover:bg-shapeships-grey-20"
          >
            Dev Mode
          </Button>
        </div>
      )}
      {renderShell()}
    </div>
  );
}
