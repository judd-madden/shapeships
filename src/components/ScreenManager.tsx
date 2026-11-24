import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';
import type { Player } from '../game/hooks/usePlayer';
import type { AccountIdentity } from '../game/client/account/types';
import type { ClaimNameActions } from '../game/client/account/claimNameForm';
import { guestEntryFailure } from '../game/client/gameSession/accountSessionWiring';
import type { EntryAccountActions, EntryNotice, EntryResult } from '../game/client/account/entryForm';
import type { CreatePrivateGameSettings } from './panels/CreatePrivateGamePanel';
import { LoginShell } from './shells/LoginShell';
import { MenuShell } from './shells/MenuShell';
import { attemptMobileGameFullscreen } from '../utils/mobileFullscreen';
import { StarsBackground } from '../game/display/graphics/StarsBackground';
import type { WinStreakMenuActions, WinStreakMenuViewModel } from '../game/client/winStreak/types';

type ShellId = 'login' | 'menu';

interface ScreenManagerProps {
  player: Player | null;
  accountIdentity: AccountIdentity | null;
  claimNameActions: ClaimNameActions;
  entryActions: EntryAccountActions;
  entryNotice: EntryNotice | null;
  onEntryNoticeConsumed(): void;
  rememberedAccountUnavailable: boolean;
  onAccountLogout: () => void;
  onMenuEntered: () => void;
  initialShell: ShellId;
  pendingInviteGameId: string | null;
  onCreatePrivateGame: (settings: CreatePrivateGameSettings) => Promise<string>;
  onCreateComputerGame: (settings: CreatePrivateGameSettings) => Promise<string>;
  onLaunchGame: (gameId: string) => void;
  onResetPlayerSession: () => void;
  onStartSession: (displayName: string) => Promise<void>;
  onSwitchToDevMode: () => void;
  isDevModeAvailable: boolean;
  winStreakViewModel: WinStreakMenuViewModel;
  winStreakActions: WinStreakMenuActions;
}

export default function ScreenManager({
  player,
  accountIdentity,
  claimNameActions,
  entryActions,
  entryNotice,
  onEntryNoticeConsumed,
  rememberedAccountUnavailable,
  onAccountLogout,
  onMenuEntered,
  initialShell,
  pendingInviteGameId,
  onCreatePrivateGame,
  onCreateComputerGame,
  onLaunchGame,
  onResetPlayerSession,
  onStartSession,
  onSwitchToDevMode,
  isDevModeAvailable,
  winStreakViewModel,
  winStreakActions,
}: ScreenManagerProps) {
  const [currentShell, setCurrentShell] = useState<ShellId>(initialShell);
  const [isStartingSession, setIsStartingSession] = useState(false);

  useEffect(() => {
    setCurrentShell(initialShell);
  }, [initialShell]);

  useEffect(() => {
    if (currentShell === 'menu') onMenuEntered();
  }, [currentShell, onMenuEntered]);

  const navigateToShell = (shell: string) => {
    if (shell === 'login' || shell === 'menu') {
      setCurrentShell(shell);
    }
  };

  const handleNameSubmit = async (displayName: string): Promise<EntryResult> => {
    try {
      await onStartSession(displayName);
      return { kind: 'ok' };
    } catch (error) {
      return guestEntryFailure(error);
    }
  };

  const handleEntered = () => {
    if (pendingInviteGameId) onLaunchGame(pendingInviteGameId);
    else setCurrentShell('menu');
  };

  const handleGameCreated = (gameId: string) => {
    onLaunchGame(gameId);
  };

  const handleExitToEntry = () => {
    onResetPlayerSession();
    setCurrentShell('login');
  };

  const handleLogout = () => {
    onAccountLogout();
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
            onCreateComputerGame={onCreateComputerGame}
            player={player}
            accountIdentity={accountIdentity}
            claimNameActions={claimNameActions}
            winStreakViewModel={winStreakViewModel}
            winStreakActions={winStreakActions}
          />
        );
      case 'login':
      default:
        return (
          <LoginShell
            onNameSubmit={handleNameSubmit}
            actions={entryActions}
            notice={entryNotice}
            onNoticeConsumed={onEntryNoticeConsumed}
            rememberedUnavailable={rememberedAccountUnavailable}
            onEntered={handleEntered}
            onBusyChange={setIsStartingSession}
            onAttempt={() => { if (pendingInviteGameId) attemptMobileGameFullscreen(); }}
            primaryCtaLabel={pendingInviteGameId ? 'JOIN GAME' : 'PLAY'}
          />
        );
    }
  };

  return (
    <div
      className="ss-playerRoot relative isolate min-h-screen"
    >
      <div className="fixed inset-0 z-0">
        <StarsBackground />
      </div>

      {isDevModeAvailable && (
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

      <div className="relative z-10">
        {renderShell()}
      </div>
    </div>
  );
}
