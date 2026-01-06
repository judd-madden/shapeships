import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { supabase } from '../utils/supabase/client';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import globalAssets from '../graphics/global/assets';
import { usePlayer } from '../game/hooks/usePlayer';
import { clearSession } from '../utils/sessionManager';

// ============================================================================
// ALPHA v3 FEATURE FLAGS
// ============================================================================
// Set to false Post-Alpha to re-enable authentication flows
const ALPHA_DISABLE_AUTH = true;

// ============================================================================
// SCREEN MANAGER (Coordinator - NOT a Shell)
// ============================================================================
// This component coordinates which Shell to render based on app state.
// It is NOT a shell itself - it delegates to LoginShell, MenuShell, etc.
// ============================================================================

export default function ScreenManager({ onSwitchToDevMode }) {
  const [currentShell, setCurrentShell] = useState('login');
  const [user, setUser] = useState(null);
  const [activeGameId, setActiveGameId] = useState(null);
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

  const navigateToShell = (shell) => {
    setCurrentShell(shell);
  };

  const handleNameSubmit = (displayName) => {
    updatePlayerName(displayName);
    setCurrentShell('menu');
  };

  const handleGameCreated = (gameId) => {
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
  const handleSuccessfulLogin = (userData) => {
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
          user={user}
          player={player}
          alphaDisableAuth={ALPHA_DISABLE_AUTH}
        />;
      case 'game':
        return <GameShell 
          onExit={handleExitGame}
          gameId={activeGameId}
        />;
      // Post-Alpha: Add additional shells here
      default:
        return <LoginShell 
          onNavigate={navigateToShell} 
          onNameSubmit={handleNameSubmit}
          onLogin={handleSuccessfulLogin}
          alphaDisableAuth={ALPHA_DISABLE_AUTH}
        />;
    }
  };

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-no-repeat relative"
      style={{ 
        backgroundImage: `url(${globalAssets.spaceBackground})`,
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

// ============================================================================
// LOGIN SHELL
// ============================================================================
// Canonical Shell for entry/authentication flows
// Owns layout for login area, swaps panels based on Alpha vs Post-Alpha
// ============================================================================

function LoginShell({ onNavigate, onNameSubmit, onLogin, alphaDisableAuth }) {
  const [activePanel, setActivePanel] = useState('enterName');

  const renderPanel = () => {
    // Alpha v3: Only EnterNamePanel is accessible
    if (alphaDisableAuth) {
      return <EnterNamePanel onSubmit={onNameSubmit} />;
    }

    // Post-Alpha: Full auth flow
    switch (activePanel) {
      case 'enterName':
        return <EnterNamePanel onSubmit={onNameSubmit} />;
      case 'login':
        return <LoginPanel 
          onNavigate={setActivePanel} 
          onLogin={onLogin} 
        />;
      case 'createAccount':
        return <CreateAccountPanel 
          onNavigate={setActivePanel} 
          onAccountCreated={() => setActivePanel('login')} 
        />;
      case 'forgotPassword':
        return <ForgotPasswordPanel onNavigate={setActivePanel} />;
      default:
        return <EnterNamePanel onSubmit={onNameSubmit} />;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-md">
      <div className="mb-8">
        <h1 className="text-white drop-shadow-lg">Shapeships</h1>
        {alphaDisableAuth && (
          <p className="text-shapeships-grey-20 text-sm mt-2">Alpha v3 - Session Play</p>
        )}
      </div>
      {renderPanel()}
    </div>
  );
}

// ============================================================================
// MENU SHELL
// ============================================================================
// Canonical Shell for main menu/lobby
// Owns layout with left navigation and main content area
// ============================================================================

function MenuShell({ onNavigate, onExit, onLogout, onGameCreated, user, player, alphaDisableAuth }) {
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
// GAME SHELL
// ============================================================================
// Canonical Shell for in-game experience
// Owns layout with game canvas and control panel
// ============================================================================

function GameShell({ onExit, gameId }) {
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-white drop-shadow-lg">Shapeships</h1>
        <p className="text-white/90 drop-shadow-md">Game ID: {gameId}</p>
      </div>

      {/* Main Layout: Game Canvas + Control Panel */}
      <div className="flex gap-6">
        {/* Game Canvas */}
        <div className="flex-1">
          <Card className="backdrop-blur-sm border-shapeships-grey-20/30" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}>
            <CardContent className="p-4">
              <div className="w-full h-96 bg-shapeships-grey-20/10">
                {/* Placeholder for game canvas */}
                <p className="text-center text-shapeships-grey-90">Game Canvas</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Control Panel */}
        <div className="w-64 flex-shrink-0">
          <Card className="backdrop-blur-sm border-shapeships-grey-20/30" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}>
            <CardContent className="p-4">
              <nav className="space-y-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-left text-shapeships-red hover:text-shapeships-red hover:bg-shapeships-pastel-red/10"
                  onClick={onExit}
                >
                  Exit Game
                </Button>
              </nav>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// LOGIN SHELL PANELS
// ============================================================================

// ALPHA v3: EnterNamePanel (Session-Only Entry)
function EnterNamePanel({ onSubmit }) {
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const { player } = usePlayer();

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalName = displayName.trim() || player?.name || 'Player';
    setLoading(true);
    onSubmit(finalName);
  };

  return (
    <Card className="backdrop-blur-sm border-shapeships-grey-20/30" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}>
      <CardHeader>
        <CardTitle className="text-shapeships-grey-90">Enter Your Name</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-2 text-sm text-shapeships-grey-90">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={player?.name || "Your name"}
              className="w-full px-3 py-2 border border-shapeships-grey-20 rounded-md bg-shapeships-white text-shapeships-grey-90"
            />
            <p className="text-xs text-shapeships-grey-50 mt-1">
              Session only - not stored after you close the browser
            </p>
          </div>
          
          <Button 
            type="submit" 
            disabled={loading}
            className="w-full bg-shapeships-blue text-shapeships-white hover:bg-shapeships-blue/90"
          >
            {loading ? 'Entering...' : 'Continue to Menu'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// POST-ALPHA: LoginPanel (Email/Password Authentication)
// Preserved but unreachable in Alpha v3
function LoginPanel({ onNavigate, onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      onLogin(data.user);
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayAsGuest = () => {
    onLogin({ id: 'guest', email: 'guest@local' });
  };

  return (
    <Card className="backdrop-blur-sm border-shapeships-grey-20/30" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}>
      <CardContent className="p-6">
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block mb-1 text-shapeships-grey-90">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border-shapeships-grey-20 rounded-md bg-shapeships-white text-shapeships-grey-90"
            />
          </div>
          
          <div>
            <label className="block mb-1 text-shapeships-grey-90">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border-shapeships-grey-20 rounded-md bg-shapeships-white text-shapeships-grey-90"
            />
          </div>
          
          <Button type="submit" disabled={loading} className="w-full bg-shapeships-blue text-shapeships-white hover:bg-shapeships-blue/90">
            {loading ? 'Processing...' : 'Login'}
          </Button>
        </form>

        <div className="mt-4 space-y-2">
          <Button 
            variant="outline" 
            onClick={() => onNavigate('createAccount')} 
            className="w-full border-shapeships-grey-20 text-shapeships-grey-90 hover:bg-shapeships-grey-20/10"
          >
            Create Account
          </Button>
          
          <Button 
            variant="outline" 
            onClick={handlePlayAsGuest} 
            className="w-full border-shapeships-pastel-blue text-shapeships-blue hover:bg-shapeships-pastel-blue/10"
          >
            Play as Guest
          </Button>
        </div>

        <div className="mt-4 text-center">
          <button 
            type="button"
            onClick={() => onNavigate('forgotPassword')}
            className="text-sm underline text-shapeships-grey-70 hover:text-shapeships-grey-90"
          >
            Forgot Password
          </button>
        </div>

        {message && (
          <div className="mt-4 p-3 rounded-md text-sm bg-shapeships-pastel-red/20 text-shapeships-red border border-shapeships-pastel-red/30">
            {message}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// POST-ALPHA: CreateAccountPanel (Account Registration)
// Preserved but unreachable in Alpha v3
function CreateAccountPanel({ onNavigate, onAccountCreated }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ email, password, name }),
      });

      if (response.ok) {
        setMessage('Account created successfully!');
        setTimeout(() => {
          onAccountCreated();
        }, 2000);
      } else {
        const error = await response.text();
        throw new Error(error);
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button variant="outline" onClick={() => onNavigate('login')} className="mb-4 border-shapeships-grey-20 text-shapeships-grey-90 hover:bg-shapeships-grey-20/10 bg-shapeships-white/90">
        Back to Login
      </Button>

      <Card className="backdrop-blur-sm border-shapeships-grey-20/30" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}>
        <CardContent className="p-6">
          <form onSubmit={handleCreateAccount} className="space-y-4">
            <div>
              <label className="block mb-1 text-shapeships-grey-90">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 border-shapeships-grey-20 rounded-md bg-shapeships-white text-shapeships-grey-90"
              />
            </div>

            <div>
              <label className="block mb-1 text-shapeships-grey-90">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border-shapeships-grey-20 rounded-md bg-shapeships-white text-shapeships-grey-90"
              />
            </div>
            
            <div>
              <label className="block mb-1 text-shapeships-grey-90">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border-shapeships-grey-20 rounded-md bg-shapeships-white text-shapeships-grey-90"
              />
            </div>
            
            <Button type="submit" disabled={loading} className="w-full bg-shapeships-green text-shapeships-white hover:bg-shapeships-green/90">
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>

          {message && (
            <div className={`mt-4 p-3 rounded-md text-sm border ${
              message.includes('Error') 
                ? 'bg-shapeships-pastel-red/20 text-shapeships-red border-shapeships-pastel-red/30' 
                : 'bg-shapeships-pastel-green/20 text-shapeships-green border-shapeships-pastel-green/30'
            }`}>
              {message}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// POST-ALPHA: ForgotPasswordPanel (Password Reset)
// Preserved but unreachable in Alpha v3
function ForgotPasswordPanel({ onNavigate }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      
      if (error) throw error;
      setMessage('Password reset email sent!');
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button variant="outline" onClick={() => onNavigate('login')} className="mb-4 border-shapeships-grey-20 text-shapeships-grey-90 hover:bg-shapeships-grey-20/10 bg-shapeships-white/90">
        Back to Login
      </Button>

      <Card className="backdrop-blur-sm border-shapeships-grey-20/30" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}>
        <CardContent className="p-6">
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block mb-1 text-shapeships-grey-90">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border-shapeships-grey-20 rounded-md bg-shapeships-white text-shapeships-grey-90"
              />
            </div>
            
            <Button type="submit" disabled={loading} className="w-full bg-shapeships-orange text-shapeships-white hover:bg-shapeships-orange/90">
              {loading ? 'Sending...' : 'Send Reset Email'}
            </Button>
          </form>

          {message && (
            <div className={`mt-4 p-3 rounded-md text-sm border ${
              message.includes('Error') 
                ? 'bg-shapeships-pastel-red/20 text-shapeships-red border-shapeships-pastel-red/30' 
                : 'bg-shapeships-pastel-green/20 text-shapeships-green border-shapeships-pastel-green/30'
            }`}>
              {message}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// MENU SHELL PANELS
// ============================================================================

// ALPHA v3: MultiplayerPanel (Private Games Only)
function MultiplayerPanel({ alphaDisableAuth, onGameCreated }) {
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
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/create-game`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ 
          playerName: player.name,
          playerId: player.id
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setGameId(result.gameId);
        
        // Trigger navigation to GameShell via callback
        onGameCreated(result.gameId);
      } else {
        const errorText = await response.text();
        setError(`Failed to create game: ${errorText}`);
      }
    } catch (error) {
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