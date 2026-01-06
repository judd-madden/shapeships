import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { usePlayer } from '../../game/hooks/usePlayer';
import { authenticatedPost } from '../../utils/sessionManager';

// ============================================================================
// MENU SHELL
// ============================================================================
// Canonical Shell for main menu/lobby
// Owns layout with left navigation and main content area
// ============================================================================

interface MenuShellProps {
  onNavigate: (destination: string) => void;
  onExit: () => void;
  onLogout: () => void;
  onGameCreated: (gameId: string) => void;
  user: any;
  player: any;
  alphaDisableAuth: boolean;
}

export function MenuShell({ onNavigate, onExit, onLogout, onGameCreated, user, player, alphaDisableAuth }: MenuShellProps) {
  const [activePanel, setActivePanel] = useState('multiplayer');

  const displayName = player?.name || user?.user_metadata?.name || user?.email || 'Player';

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-white drop-shadow-lg">Shapeships</h1>
        <p className="text-white/90 drop-shadow-md">Welcome, {displayName}</p>
        {alphaDisableAuth && (
          <Badge variant="outline" className="mt-2 bg-shapeships-white/20 text-white border-white/30">
            Alpha v3 - Private Games Only
          </Badge>
        )}
      </div>

      {/* Main Layout: Sidebar + Content */}
      <div className="flex gap-6">
        {/* Left Navigation */}
        <div className="w-64 flex-shrink-0">
          <Card className="backdrop-blur-sm border-shapeships-grey-20/30" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}>
            <CardContent className="p-4">
              <nav className="space-y-2">
                <Button
                  variant={activePanel === 'multiplayer' ? 'default' : 'ghost'}
                  className="w-full justify-start text-left"
                  onClick={() => setActivePanel('multiplayer')}
                >
                  Multiplayer
                </Button>
                <Button
                  variant={activePanel === 'rules' ? 'default' : 'ghost'}
                  className="w-full justify-start text-left"
                  onClick={() => setActivePanel('rules')}
                >
                  Rules & Codex
                </Button>
                <Separator className="my-2" />
                <Button
                  variant="ghost"
                  className="w-full justify-start text-left text-shapeships-red hover:text-shapeships-red hover:bg-shapeships-pastel-red/10"
                  onClick={alphaDisableAuth ? onExit : onLogout}
                >
                  {alphaDisableAuth ? 'Exit' : 'Logout'}
                </Button>
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Area */}
        <div className="flex-1">
          {activePanel === 'multiplayer' && <MultiplayerPanel alphaDisableAuth={alphaDisableAuth} onGameCreated={onGameCreated} />}
          {activePanel === 'rules' && <RulesPanel />}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MENU SHELL PANELS
// ============================================================================

// ============================================================================
// ALPHA v3 ENDPOINT CONFIGURATION
// ============================================================================
// Private game creation endpoint (Alpha v3 only)
// Post-Alpha: Will add /create-public-game or /quick-match endpoints
const CREATE_PRIVATE_GAME_ENDPOINT = '/make-server-825e19ab/create-game';
// ============================================================================

// ALPHA v3: MultiplayerPanel (Private Games Only)
function MultiplayerPanel({ alphaDisableAuth, onGameCreated }: { alphaDisableAuth: boolean; onGameCreated: (gameId: string) => void }) {
  const [gameId, setGameId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const { player } = usePlayer();

  const handleCreatePrivateGame = async () => {
    if (!player) {
      setError('Player not initialized');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      // Alpha v3: Create private game with server-minted session identity
      // sessionToken is handled automatically by authenticatedPost
      // playerId is derived server-side from sessionToken (NOT sent by client)
      const response = await authenticatedPost(CREATE_PRIVATE_GAME_ENDPOINT, {
        playerName: player.name // Metadata only - server derives identity from token
      });

      if (response.ok) {
        const result = await response.json();
        setGameId(result.gameId);
        
        console.log(`✅ Game created: ${result.gameId}`);
        
        // Trigger navigation to GameShell via callback
        onGameCreated(result.gameId);
      } else {
        const errorText = await response.text();
        console.error(`❌ Failed to create game: ${errorText}`);
        setError(`Failed to create game: ${errorText}`);
      }
    } catch (error: any) {
      console.error(`❌ Network error creating game:`, error);
      setError(`Network error: ${error.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Card className="backdrop-blur-sm border-shapeships-grey-20/30" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}>
      <CardHeader>
        <CardTitle className="text-shapeships-grey-90">Multiplayer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Alpha v3: Private Game Creation */}
        <div>
          <h3 className="font-semibold text-shapeships-grey-90 mb-2">Private Games</h3>
          <p className="text-sm text-shapeships-grey-70 mb-3">
            Create a private game and share the link with a friend
          </p>
          <Button 
            onClick={handleCreatePrivateGame}
            disabled={isCreating}
            className="w-full bg-shapeships-green text-shapeships-white hover:bg-shapeships-green/90"
          >
            {isCreating ? 'Creating Game...' : 'Create Private Game'}
          </Button>
          {error && (
            <div className="mt-2 p-3 bg-shapeships-pastel-red/20 text-shapeships-red text-sm rounded-md border border-shapeships-pastel-red/30">
              {error}
            </div>
          )}
        </div>

        <Separator />

        {/* Post-Alpha: Public Lobby (Disabled in Alpha) */}
        {/* No routing, no functionality - placeholder only */}
        <div className="opacity-50">
          <h3 className="font-semibold text-shapeships-grey-90 mb-2">Public Lobby</h3>
          <p className="text-sm text-shapeships-grey-70 mb-3 italic">
            Coming in future release - match with random opponents
          </p>
          <Button 
            disabled
            variant="outline"
            className="w-full"
          >
            Quick Match (Coming Soon)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ALPHA v3: RulesPanel (Stub - To be implemented)
function RulesPanel() {
  return (
    <Card className="backdrop-blur-sm border-shapeships-grey-20/30" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}>
      <CardHeader>
        <CardTitle className="text-shapeships-grey-90">Rules & Codex</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-shapeships-grey-70 mb-4">
          Learn how to play Shapeships and master the tactics of each species.
        </p>
        <div className="space-y-2">
          <Button variant="outline" disabled className="w-full justify-start">
            Core Rules
          </Button>
          <Button variant="outline" disabled className="w-full justify-start">
            Human Species Guide
          </Button>
          <Button variant="outline" disabled className="w-full justify-start">
            Xenite Species Guide
          </Button>
          <Button variant="outline" disabled className="w-full justify-start">
            Centaur Species Guide
          </Button>
          <Button variant="outline" disabled className="w-full justify-start">
            Ancient Species Guide
          </Button>
          <Button variant="outline" disabled className="w-full justify-start">
            Turn Timing Reference
          </Button>
        </div>
        <p className="text-xs text-shapeships-grey-50 mt-4 italic">
          Full rules system implementation coming soon
        </p>
      </CardContent>
    </Card>
  );
}
