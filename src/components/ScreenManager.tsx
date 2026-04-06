import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';
import type { Player } from '../game/hooks/usePlayer';
import { LoginShell } from './shells/LoginShell';
import { MenuShell } from './shells/MenuShell';

const ALPHA_DISABLE_AUTH = true;

type ShellId = 'login' | 'menu';

interface ScreenManagerProps {
  player: Player | null;
  initialShell: ShellId;
  pendingInviteGameId: string | null;
  onCreatePrivateGame: () => Promise<string>;
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
          />
        );
    }
  };

  return (
    <div
      className="min-h-screen relative"
      style={{
        backgroundImage: 'url(https://juddmadden.com/shapeships/images/space-background.jpg)',
        backgroundAttachment: 'fixed',
        backgroundSize: 'cover',
        backgroundPosition: 'top center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#000033',
      }}
    >
      <div className="fixed top-4 right-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={onSwitchToDevMode}
          disabled={isStartingSession}
          className="bg-shapeships-white shadow-md border-shapeships-grey-20 text-shapeships-grey-90 hover:bg-shapeships-grey-20/10"
        >
          Dev Mode
        </Button>
      </div>
      {renderShell()}
    </div>
  );
}
