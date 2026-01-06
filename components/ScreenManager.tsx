/**
 * SCREEN MANAGER
 * 
 * Coordinator (NOT a Shell)
 * Owns app-level state and navigation logic
 * Delegates rendering to LoginShell, MenuShell, GameShell
 * 
 * ARCHITECTURE:
 * ┌─────────────────────────────────────────────────────────────┐
 * │ ScreenManager (Coordinator)                                 │
 * │ - App-level state (player, user, activeGameId)             │
 * │ - Navigation logic (handleNameSubmit, handleGameCreated)   │
 * │ - Backend integration (handleCreatePrivateGame)            │
 * └─────────────────────────────────────────────────────────────┘
 *                           │
 *          ┌────────────────┼────────────────┐
 *          ▼                ▼                ▼
 *    LoginShell        MenuShell        GameShell
 *    (Layout)          (Layout)         (Layout)
 *          │                │
 *          ▼                ▼
 *     Panels           Panels
 *  - EnterName      - Multiplayer
 *  - Login          - Rules
 *  - CreateAccount
 *  - ForgotPassword
 */

import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { usePlayer } from '../game/hooks/usePlayer';
import { clearSession, authenticatedPost } from '../utils/sessionManager';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { LoginShell } from './shells/LoginShell';
import { MenuShell } from './shells/MenuShell';
import { GameShell } from './shells/GameShell';

// ============================================================================
// ALPHA v3 FEATURE FLAGS
// ============================================================================
// Set to false Post-Alpha to re-enable authentication flows
const ALPHA_DISABLE_AUTH = true;

// ============================================================================
// SCREEN MANAGER
// ============================================================================

interface ScreenManagerProps {
  onSwitchToDevMode: () => void;
}

export default function ScreenManager({ onSwitchToDevMode }: ScreenManagerProps) {
  const [currentShell, setCurrentShell] = useState('login');
  const [user, setUser] = useState(null);
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const { player, updatePlayerName, clearPlayer } = usePlayer();

  // Check URL parameters on mount (for direct game links)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const gameParam = urlParams.get('game');
    
    if (gameParam) {
      // Direct link to game - ensure player exists then navigate to game
      if (player) {
        setActiveGameId(gameParam);
        setCurrentShell('game');
      }
    }
  }, [player]);

  // ============================================================================
  // NAVIGATION HANDLERS
  // ============================================================================

  const navigateToShell = (shell: string) => {
    setCurrentShell(shell);
  };

  const handleNameSubmit = (displayName: string) => {
    updatePlayerName(displayName);
    setCurrentShell('menu');
  };

  const handleGameCreated = (gameId: string) => {
    setActiveGameId(gameId);
    setCurrentShell('game');
    
    // Update URL without reload
    const newUrl = `${window.location.pathname}?game=${gameId}`;
    window.history.pushState({}, '', newUrl);
  };

  const handleExitGame = () => {
    setActiveGameId(null);
    setCurrentShell('menu');
    
    // Clear URL parameters
    window.history.pushState({}, '', window.location.pathname);
  };

  const handleExitToEntry = () => {
    // ALPHA v3 EXIT SEMANTICS:
    // Exit completely resets identity (both display name and session token)
    // User must re-enter name and gets new session on next action
    clearPlayer();          // Clear display name from local state
    clearSession();         // Clear session token from localStorage
    setUser(null);
    setCurrentShell('login');
    console.log('🚪 Exit: Player and session cleared, returned to entry');
  };

  // Post-Alpha auth handlers (preserved but unused in Alpha)
  const handleSuccessfulLogin = (userData: any) => {
    setUser(userData);
    setCurrentShell('menu');
  };

  const handleLogout = () => {
    // Post-Alpha logout also clears session
    clearPlayer();
    clearSession();
    setUser(null);
    setCurrentShell('login');
    console.log('🚪 Logout: Player and session cleared');
  };

  // ============================================================================
  // BACKEND INTEGRATION (App-Level)
  // ============================================================================

  const handleCreatePrivateGame = async (): Promise<string> => {
    if (!player) {
      throw new Error('Player not initialized');
    }

    try {
      const response = await authenticatedPost('/create-game', {
        playerName: player.name,
        playerId: player.id
      });

      if (response.ok) {
        const result = await response.json();
        return result.gameId;
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to create game: ${errorText}`);
      }
    } catch (error: any) {
      throw new Error(`Network error: ${error.message}`);
    }
  };

  // ============================================================================
  // SHELL RENDERING
  // ============================================================================

  const renderShell = () => {
    switch (currentShell) {
      case 'login':
        return <LoginShell 
          onNavigate={navigateToShell} 
          onNameSubmit={handleNameSubmit}
          onLogin={handleSuccessfulLogin}
          alphaDisableAuth={ALPHA_DISABLE_AUTH}
        />;
      case 'menu':
        return <MenuShell 
          onNavigate={navigateToShell} 
          onExit={handleExitToEntry}
          onLogout={handleLogout}
          onGameCreated={handleGameCreated}
          onCreatePrivateGame={handleCreatePrivateGame}
          user={user}
          player={player}
          alphaDisableAuth={ALPHA_DISABLE_AUTH}
        />;
      case 'game':
        return <GameShell 
          onExit={handleExitGame}
          gameId={activeGameId}
        />;
      default:
        return <LoginShell 
          onNavigate={navigateToShell} 
          onNameSubmit={handleNameSubmit}
          onLogin={handleSuccessfulLogin}
          alphaDisableAuth={ALPHA_DISABLE_AUTH}
        />;
    }
  };

  // ============================================================================
  // MAIN LAYOUT
  // ============================================================================

  return (
    <div 
      className="min-h-screen relative"
      style={{ 
        backgroundImage: 'url(https://juddmadden.com/shapeships/images/space-background.jpg)',
        backgroundAttachment: 'fixed',
        backgroundSize: 'cover',
        backgroundPosition: 'top center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#000033'
      }}
    >
      <div className="fixed top-4 right-4 z-50">
        <Button 
          variant="outline" 
          size="sm"
          onClick={onSwitchToDevMode}
          className="bg-shapeships-white shadow-md border-shapeships-grey-20 text-shapeships-grey-90 hover:bg-shapeships-grey-20/10"
        >
          🔧 Dev Mode
        </Button>
      </div>
      {renderShell()}
    </div>
  );
}