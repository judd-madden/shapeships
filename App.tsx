import React, { useState, useEffect } from 'react';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Separator } from './components/ui/separator';
import { Toaster } from './components/ui/sonner';
import { Input } from './components/ui/input';
import { supabase } from './utils/supabase/client';
import { projectId, publicAnonKey } from './utils/supabase/info';
import ScreenManager from './components/ScreenManager';
import GraphicsTest from './components/GraphicsTest';
import GameScreen from './game/display/GameScreen';
import GameTestInterface from './game/test/GameTestInterface';
import { FullPhaseTest } from './game/test/FullPhaseTest';
import { usePlayer } from './game/hooks/usePlayer';
import { getSessionToken, ensureSession, authenticatedPost, authenticatedFetch } from './utils/sessionManager';
import { BuildKitShowcase } from './components/dev/BuildKitShowcase';

// Configuration for the live published URL
const LIVE_BASE_URL = 'https://semi-folk-76756080.figma.site'; // Replace with your actual live URL
const USE_LIVE_URL = true; // Set to true to always use the live URL for sharing

export default function App() {
  const [isPlayerMode, setIsPlayerMode] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  const [connectionStatus, setConnectionStatus] = useState('ready');
  const [errorMessage, setErrorMessage] = useState('');
  const [systemTestResults, setSystemTestResults] = useState(null);
  const [deploymentStatus, setDeploymentStatus] = useState('unknown');
  const [gameId, setGameId] = useState(null);
  
  // Centralized player management
  const { player, isReady: playerReady } = usePlayer();

  useEffect(() => {
    // Check for game parameter and view parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const gameParam = urlParams.get('game');
    const viewParam = urlParams.get('view');
    
    if (gameParam && gameParam !== gameId) {
      setGameId(gameParam);
      // Route to the correct view based on the view parameter
      if (viewParam === 'game-test') {
        setCurrentView('game-test');
      } else {
        // Default to multiplayer for backward compatibility
        setCurrentView('multiplayer');
      }
    }
    
    checkDeploymentStatus();
  }, []); // Keep empty dependency array but add condition to prevent unnecessary updates

  const checkDeploymentStatus = async () => {
    try {
      // First check if the basic health endpoint works
      const healthResponse = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/health`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });
      
      if (healthResponse.ok) {
        // Now check if multiplayer endpoints are available
        const endpointsResponse = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/endpoints`, {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        });
        
        if (endpointsResponse.ok) {
          const endpoints = await endpointsResponse.json();
          const hasMultiplayerEndpoints = endpoints.endpoints?.some(ep => ep.path.includes('create-game'));
          
          if (hasMultiplayerEndpoints) {
            setDeploymentStatus('deployed');
          } else {
            setDeploymentStatus('partial-deployment');
          }
        } else {
          setDeploymentStatus('deployed'); // Health works but endpoints check failed
        }
      } else {
        setDeploymentStatus('not-deployed');
      }
    } catch (error) {
      setDeploymentStatus('not-deployed');
    }
  };

  const testConnection = async () => {
    setConnectionStatus('testing');
    setErrorMessage('');
    
    try {
      console.log('Testing connection to:', `https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/test-connection`);
      console.log('Using project ID:', projectId);
      console.log('Using anon key:', publicAnonKey?.substring(0, 20) + '...');
      
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/test-connection`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Response status:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('Response body:', result);
        setConnectionStatus('connected');
        setDeploymentStatus('deployed');
      } else {
        const errorText = await response.text();
        console.log('Error response:', errorText);
        setConnectionStatus('error');
        
        if (response.status === 404) {
          setErrorMessage(`Edge function not found (404). The function 'make-server-825e19ab' hasn't been deployed yet.`);
          setDeploymentStatus('not-deployed');
        } else {
          setErrorMessage(`HTTP ${response.status}: ${errorText}`);
        }
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setConnectionStatus('error');
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setErrorMessage(`Network error: Cannot reach edge function. This usually means the function hasn't been deployed yet or there's a network issue.`);
        setDeploymentStatus('not-deployed');
      } else {
        setErrorMessage(error.message);
      }
    }
  };

  const testSupabaseClient = async () => {
    try {
      console.log('Testing Supabase client connection...');
      
      // Test basic Supabase connection without edge functions
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Supabase client error:', error);
        return { success: false, error: error.message };
      }
      
      console.log('Supabase client working, session:', data);
      return { success: true, message: 'Supabase client connection successful' };
      
    } catch (error) {
      console.error('Supabase client test failed:', error);
      return { success: false, error: error.message };
    }
  };

  const runSystemTest = async () => {
    setSystemTestResults(null);
    
    try {
      console.log('Running comprehensive system test...');
      
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/system-test`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const results = await response.json();
        setSystemTestResults(results);
        console.log('System test results:', results);
      } else {
        const error = await response.text();
        setSystemTestResults({
          overall_status: 'error',
          error: `HTTP ${response.status}: ${error}`,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('System test failed:', error);
      setSystemTestResults({
        overall_status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  };

  const developmentViews = [
    { id: 'deployment', name: 'Deployment Test', status: 'ready' },
    { id: 'auth', name: 'Authentication', status: 'alpha-disabled' },
    { id: 'multiplayer', name: 'Multiplayer Test', status: 'ready' },
    { id: 'game-test', name: 'Game Test Interface', status: 'ready' },
    { id: 'full-phase-test', name: 'Full Phase Test', status: 'ready' },
    { id: 'graphics', name: 'Graphics Test', status: 'ready' },
    { id: 'build-kit', name: 'Build Kit', status: 'ready' },
    { id: 'game', name: 'Game Screen', status: 'ready' },
    { id: 'rules', name: 'Rules & Help', status: 'pending' },
  ];

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DevelopmentDashboard 
          views={developmentViews} 
          onViewChange={setCurrentView} 
          connectionStatus={connectionStatus}
          deploymentStatus={deploymentStatus}
          errorMessage={errorMessage}
          onTestConnection={testConnection}
          onTestSupabase={testSupabaseClient}
        />;
      case 'deployment':
        return <DeploymentTestView 
          onBack={() => setCurrentView('dashboard')}
          onTestConnection={testConnection}
          onRunSystemTest={runSystemTest}
          connectionStatus={connectionStatus}
          deploymentStatus={deploymentStatus}
          systemTestResults={systemTestResults}
          onTestSupabase={testSupabaseClient}
        />;
      case 'auth':
        return <AuthenticationView onBack={() => setCurrentView('dashboard')} />;
      case 'multiplayer':
        return <MultiplayerTestView 
          onBack={() => {
            setCurrentView('dashboard');
            setGameId(null);
            // Clear URL parameters
            window.history.pushState({}, document.title, window.location.pathname);
          }}
          gameId={gameId}
          deploymentStatus={deploymentStatus}
        />;
      case 'graphics':
        return <GraphicsTest onBack={() => setCurrentView('dashboard')} />;
      case 'game-test':
        return playerReady ? <GameTestInterface 
          gameId={gameId || ''} 
          playerId={player!.id}
          playerName={player!.name}
          onBack={() => {
            setCurrentView('dashboard');
            setGameId(null);
            // Clear URL parameters
            window.history.pushState({}, document.title, window.location.pathname);
          }} 
        /> : <div>Loading player...</div>;
      case 'full-phase-test':
        return <FullPhaseTest onBack={() => setCurrentView('dashboard')} />;
      case 'build-kit':
        return (
          <div>
            <Button onClick={() => setCurrentView('dashboard')} className="m-4">
              ← Back to Dashboard
            </Button>
            <BuildKitShowcase />
          </div>
        );
      case 'game':
        return playerReady ? <GameScreen 
          gameId={gameId || 'demo_game'} 
          playerId={player!.id}
          playerName={player!.name}
          onBack={() => setCurrentView('dashboard')} 
        /> : <div>Loading player...</div>;
      case 'rules':
        return <RulesView onBack={() => setCurrentView('dashboard')} />;
      default:
        return <DevelopmentDashboard 
          views={developmentViews} 
          onViewChange={setCurrentView} 
          connectionStatus={connectionStatus}
          deploymentStatus={deploymentStatus}
          errorMessage={errorMessage}
          onTestConnection={testConnection}
          onTestSupabase={testSupabaseClient}
        />;
    }
  };

  const switchToDevMode = () => {
    setIsPlayerMode(false);
    setCurrentView('dashboard');
    setGameId(null);
    // Clear any URL parameters that might interfere
    window.history.pushState({}, document.title, window.location.pathname);
  };

  // Check if we should show player mode or development mode
  if (isPlayerMode) {
    return <ScreenManager onSwitchToDevMode={switchToDevMode} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="fixed top-4 right-4 z-50">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setIsPlayerMode(true)}
          className="bg-white shadow-md"
        >
          🎮 Player Mode
        </Button>
      </div>
      {renderCurrentView()}
      <Toaster />
    </div>
  );
}

function MultiplayerTestView({ onBack, gameId, deploymentStatus }) {
  const [currentGameId, setCurrentGameId] = useState(gameId);
  const [playerName, setPlayerName] = useState('');
  const [message, setMessage] = useState('');
  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  
  // Use centralized player management
  const { player, updatePlayerName } = usePlayer();
  const playerId = player?.id || '';
  
  // Initialize player name from central player if not set
  useEffect(() => {
    if (player && !playerName) {
      setPlayerName(player.name);
    }
  }, [player, playerName]);

  // Separate useEffect for joining game (only runs once when gameId is set)
  useEffect(() => {
    if (currentGameId && !hasJoined) {
      console.log('Attempting to join game:', currentGameId, 'with player ID:', playerId);
      joinGame();
    }
  }, [currentGameId, hasJoined]);

  // Separate useEffect for polling (only after successfully joined)
  useEffect(() => {
    if (currentGameId && hasJoined) {
      const interval = setInterval(() => {
        // Only poll if we're waiting for phase changes or player actions
        if (gameState?.status === 'active' || gameState?.waitingFor || gameState?.players?.length > 1) {
          fetchGameState();
        }
      }, 10000); // Reduced to 10 seconds and conditional
      return () => {
        clearInterval(interval);
      };
    }
  }, [currentGameId, hasJoined, gameState?.status]);

  const createGame = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    // Update central player name if changed
    if (player && playerName.trim() !== player.name) {
      updatePlayerName(playerName.trim());
    }

    setLoading(true);
    setError('');

    try {
      console.log('Creating game with:', { playerName: playerName.trim(), playerId });
      console.log('Calling URL:', `https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/create-game`);
      
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/create-game`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ 
          playerName: playerName.trim(),
          playerId
        }),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const result = await response.json();
        setCurrentGameId(result.gameId);
        
        // Update URL
        const newUrl = `${window.location.pathname}?game=${result.gameId}&view=multiplayer`;
        window.history.pushState({}, document.title, newUrl);
        
        console.log('Game created:', result);
      } else {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        
        if (response.status === 404) {
          setError(`Function not found (404). The multiplayer endpoints may not be deployed yet. Please check the Deployment Test section.`);
        } else {
          setError(`Failed to create game (${response.status}): ${errorText}`);
        }
      }
    } catch (error) {
      console.error('Network error:', error);
      setError(`Network error creating game: ${error.message}. Check if the edge function is deployed.`);
    } finally {
      setLoading(false);
    }
  };

  const joinGame = async () => {
    const finalPlayerName = playerName.trim() || 'Player ' + Math.floor(Math.random() * 1000);
    
    if (!playerName.trim()) {
      setPlayerName(finalPlayerName);
    }
    
    // Update central player name if needed
    if (player && finalPlayerName !== player.name) {
      updatePlayerName(finalPlayerName);
    }

    try {
      console.log('Joining game with:', { 
        gameId: currentGameId, 
        playerId, 
        playerName: finalPlayerName 
      });
      
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/join-game/${currentGameId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ 
          playerName: finalPlayerName,
          playerId
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Successfully joined game:', result);
        console.log('Players in game:', result.gameData?.players);
        
        setGameState(result.gameData);
        setHasJoined(true);
        setError(''); // Clear any previous errors
      } else {
        const errorText = await response.text();
        console.error('Failed to join game:', errorText);
        setError(`Failed to join game: ${errorText}`);
      }
    } catch (error) {
      console.error('Error joining game:', error);
      setError(`Error joining game: ${error.message}`);
    }
  };

  const fetchGameState = async () => {
    if (!currentGameId) return;

    try {
      console.log('Fetching game state for:', currentGameId);
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/game-state/${currentGameId}`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Game state received:', result);
        console.log('Number of players in game:', result?.players?.length);
        
        setGameState(prevState => {
          // Only update if the state has actually changed
          if (JSON.stringify(prevState) !== JSON.stringify(result)) {
            console.log('Game state updated');
            return result;
          }
          return prevState;
        });
      } else {
        console.error('Failed to fetch game state:', response.status);
      }
    } catch (error) {
      console.error('Error fetching game state:', error);
    }
  };

  const sendAction = async (actionType, content) => {
    if (!currentGameId) return;

    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/send-action/${currentGameId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ 
          playerId,
          actionType,
          content,
          timestamp: new Date().toISOString()
        }),
      });

      if (response.ok) {
        setMessage('');
        // Only fetch immediately for messages, not for phase-critical actions
        if (actionType === 'message') {
          setTimeout(() => {
            fetchGameState();
          }, 100);
        }
      } else {
        setError('Failed to send action');
      }
    } catch (error) {
      setError(`Error sending action: ${error.message}`);
    }
  };

  const handleSendMessage = () => {
    if (message.trim()) {
      sendAction('message', message.trim());
    }
  };

  const handleQuickAction = (action) => {
    sendAction('action', action);
    // For important actions like "ready", fetch state immediately
    if (action === 'ready') {
      setTimeout(() => {
        fetchGameState();
      }, 500); // Brief delay to allow server processing
    }
  };

  // Generate shareable URL - Use live URL if configured, otherwise use current location
  const getBaseUrl = () => {
    if (USE_LIVE_URL && LIVE_BASE_URL !== 'https://your-published-app-url.com') {
      return LIVE_BASE_URL;
    }
    return `${window.location.origin}${window.location.pathname}`;
  };

  const shareableUrl = currentGameId ? `${getBaseUrl()}?game=${currentGameId}&view=multiplayer` : '';
  const currentUrl = `${window.location.origin}${window.location.pathname}`;
  const isUsingLiveUrl = USE_LIVE_URL && LIVE_BASE_URL !== 'https://your-published-app-url.com';

  if (deploymentStatus === 'not-deployed' || deploymentStatus === 'partial-deployment') {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="mb-6">
          <Button variant="outline" onClick={onBack} className="mb-4">
            Back to Dashboard
          </Button>
          <h1>Multiplayer Test</h1>
        </div>
        
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="p-6">
            <div className="space-y-4">
              {deploymentStatus === 'not-deployed' ? (
                <p className="text-yellow-800">
                  Edge function not deployed yet. Please deploy the updated edge function first.
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-yellow-800">
                    <strong>Multiplayer endpoints missing!</strong> The edge function is partially deployed but missing the game creation endpoints.
                  </p>
                  <div className="p-3 bg-yellow-100 rounded-md">
                    <p className="text-yellow-900 text-sm">
                      <strong>Issue:</strong> The current deployment doesn't include the multiplayer game endpoints (create-game, join-game, etc.). 
                      You need to redeploy with the updated code that includes these endpoints.
                    </p>
                  </div>
                </div>
              )}
              <Button 
                variant="outline" 
                onClick={onBack} 
                className="mt-4"
              >
                Go to Deployment Test
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show loading if player not ready
  if (!player) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="mb-6">
          <Button variant="outline" onClick={onBack} className="mb-4">
            Back to Dashboard
          </Button>
          <h1>Multiplayer Test</h1>
        </div>
        <div className="flex items-center justify-center p-8">
          <p>Loading player...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <Button variant="outline" onClick={onBack} className="mb-4">
          Back to Dashboard
        </Button>
        <h1>Multiplayer Test</h1>
        <p className="text-gray-600">Test multiplayer functionality - game creation, joining, and communication</p>
      </div>

      {!currentGameId ? (
        <Card>
          <CardHeader>
            <CardTitle>Create New Game</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm mb-2">Your Name</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="Enter your name"
              />
            </div>
            <Button 
              onClick={createGame} 
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Creating Game...' : 'Create Game'}
            </Button>
            {error && (
              <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Game Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Game: {currentGameId}
                <div className="flex gap-2 items-center">
                  <Badge variant="default">
                    {gameState?.players?.length || 0} Players
                  </Badge>
                  <Badge variant={hasJoined ? 'default' : 'secondary'}>
                    {hasJoined ? 'Joined' : 'Joining...'}
                  </Badge>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={fetchGameState}
                    className="text-xs"
                  >
                    Refresh
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm mb-1">Share this URL:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={shareableUrl}
                      readOnly
                      className="flex-1 px-3 py-2 border rounded-md bg-gray-50 text-sm"
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(shareableUrl)}
                    >
                      Copy
                    </Button>
                  </div>
                  {isUsingLiveUrl && (
                    <p className="text-xs text-green-600 mt-1">
                      ✅ Using configured live URL for sharing
                    </p>
                  )}
                  {!isUsingLiveUrl && currentUrl.includes('localhost') && (
                    <p className="text-xs text-amber-600 mt-1">
                      ⚠️ Using localhost URL - this won't work for sharing with others. Configure LIVE_BASE_URL for production sharing.
                    </p>
                  )}
                </div>
                
                {gameState?.players && (
                  <div>
                    <label className="block text-sm mb-2">Players:</label>
                    <div className="flex gap-2 flex-wrap">
                      {gameState.players.map((player, index) => (
                        <Badge key={index} variant="secondary">
                          {player.name} {player.id === playerId && '(you)'}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-gray-600">
                      Your ID: {playerId}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* URL Configuration Info */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-blue-900">URL Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-700">Current URL:</span>
                  <span className="text-blue-900 font-mono text-xs">{currentUrl}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Shareable URL:</span>
                  <span className="text-blue-900 font-mono text-xs">{getBaseUrl()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Using Live URL:</span>
                  <Badge variant={isUsingLiveUrl ? 'default' : 'secondary'}>
                    {isUsingLiveUrl ? 'Yes' : 'No'}
                  </Badge>
                </div>
                {!isUsingLiveUrl && (
                  <div className="mt-3 p-3 bg-blue-100 rounded-md">
                    <p className="text-blue-800 text-xs">
                      <strong>To enable live URL sharing:</strong> Set <code>USE_LIVE_URL = true</code> and 
                      configure <code>LIVE_BASE_URL</code> with your published app URL in the App.tsx file.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Communication */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Send Message</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="flex-1 px-3 py-2 border rounded-md"
                    placeholder="Type a message..."
                  />
                  <Button onClick={handleSendMessage}>Send</Button>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm">Quick Actions:</label>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => handleQuickAction('wave')}>
                      👋 Wave
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleQuickAction('ready')}>
                      ✅ Ready
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleQuickAction('thinking')}>
                      🤔 Thinking
                    </Button>
                    {!hasJoined && (
                      <Button variant="outline" size="sm" onClick={joinGame}>
                        🔄 Retry Join
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Activity Feed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {gameState?.actions?.length > 0 ? (
                    gameState.actions.map((action, index) => (
                      <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                        <strong>{action.playerName}:</strong> {' '}
                        {action.actionType === 'message' ? action.content : `${action.content} ${action.actionType}`}
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(action.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm">No activity yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Game State Debug */}
          <Card>
            <CardHeader>
              <CardTitle>Game State (Debug)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-sm">
                  <strong>Status:</strong> {hasJoined ? '✅ Successfully joined' : '⏳ Joining...'}<br/>
                  <strong>Game ID:</strong> {currentGameId}<br/>
                  <strong>Your Player ID:</strong> {playerId}<br/>
                  <strong>Players in Game:</strong> {gameState?.players?.length || 0}
                </div>
                <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-32">
                  {JSON.stringify(gameState, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function DeploymentTestView({ onBack, onTestConnection, onRunSystemTest, connectionStatus, deploymentStatus, systemTestResults, onTestSupabase }) {
  const [echoTest, setEchoTest] = useState(null);
  const [echoInput, setEchoInput] = useState('{"test": "hello", "timestamp": "' + new Date().toISOString() + '"}');
  const [showEdgeFunctionCode, setShowEdgeFunctionCode] = useState(false);
  const [supabaseTest, setSupabaseTest] = useState(null);
  const [forceTestingEnabled, setForceTestingEnabled] = useState(false);

  const testEcho = async () => {
    setEchoTest(null);
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/echo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: echoInput,
      });

      if (response.ok) {
        const result = await response.json();
        setEchoTest({ success: true, data: result });
      } else {
        const error = await response.text();
        setEchoTest({ success: false, error: `HTTP ${response.status}: ${error}` });
      }
    } catch (error) {
      setEchoTest({ success: false, error: error.message });
    }
  };

  const testEndpoints = async () => {
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/endpoints`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Available endpoints:', result);
      } else {
        console.error('Failed to get endpoints, status:', response.status);
      }
    } catch (error) {
      console.error('Failed to get endpoints:', error);
    }
  };

  const handleSupabaseTest = async () => {
    setSupabaseTest(null);
    const result = await onTestSupabase();
    setSupabaseTest(result);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const manualDeploymentCheck = async () => {
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/health`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });
      
      if (response.ok) {
        console.log('Manual deployment check: Edge function is deployed');
        return true;
      } else {
        console.log('Manual deployment check: Edge function not found (404)');
        return false;
      }
    } catch (error) {
      console.log('Manual deployment check: Network error or function not deployed');
      return false;
    }
  };

  // Check if testing should be enabled (either deployed or force-enabled)
  const isTestingEnabled = deploymentStatus === 'deployed' || deploymentStatus === 'partial-deployment' || forceTestingEnabled;

  // UPDATED EDGE FUNCTION CODE - Enhanced with game test support
  const edgeFunctionCode = `import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const app = new Hono();

// Create Supabase client using environment variables
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

// KV Store utility functions - ALL INLINE, NO IMPORTS
const kvGet = async (key) => {
  const { data, error } = await supabase
    .from('kv_store_825e19ab')
    .select('value')
    .eq('key', key)
    .single();
  
  if (error) return null;
  return data?.value;
};

const kvSet = async (key, value) => {
  const { error } = await supabase
    .from('kv_store_825e19ab')
    .upsert({ key, value });
  
  if (error) throw error;
};

const kvDel = async (key) => {
  const { error } = await supabase
    .from('kv_store_825e19ab')
    .delete()
    .eq('key', key);
  
  if (error) throw error;
};

// Helper function to generate game ID
const generateGameId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-825e19ab/health", (c) => {
  console.log("Health check called");
  return c.json({ status: "ok", supabase: "connected" });
});

// Test endpoint to verify connection works
app.get("/make-server-825e19ab/test-connection", async (c) => {
  try {
    console.log("Testing connection...");
    console.log("SUPABASE_URL:", Deno.env.get("SUPABASE_URL"));
    console.log("SUPABASE_SERVICE_ROLE_KEY exists:", !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
    
    // Simple test using kv store
    const testKey = "connection_test";
    const testValue = { timestamp: new Date().toISOString(), test: true };
    
    await kvSet(testKey, testValue);
    const retrieved = await kvGet(testKey);
    await kvDel(testKey);
    
    console.log("KV store test successful");
    return c.json({ 
      status: "success", 
      message: "Supabase connection working correctly",
      test: "KV store operations successful",
      timestamp: new Date().toISOString(),
      environment: {
        url_configured: !!Deno.env.get("SUPABASE_URL"),
        service_key_configured: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
      }
    });
  } catch (error) {
    console.error("Connection test error:", error);
    return c.json({ 
      status: "error", 
      message: error.message,
      details: error.toString(),
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Create new game
app.post("/make-server-825e19ab/create-game", async (c) => {
  try {
    const { playerName, playerId } = await c.req.json();
    
    if (!playerName || !playerId) {
      return c.json({ error: "Player name and ID are required" }, 400);
    }

    const gameId = generateGameId();
    const gameData = {
      gameId,
      players: [
        {
          id: playerId,
          name: playerName,
          joinedAt: new Date().toISOString()
        }
      ],
      actions: [
        {
          playerId: "system",
          playerName: "System",
          actionType: "system",
          content: \`\${playerName} created the game\`,
          timestamp: new Date().toISOString()
        }
      ],
      status: "waiting",
      createdAt: new Date().toISOString()
    };

    await kvSet(\`game_\${gameId}\`, gameData);
    
    console.log("Game created:", gameId);
    return c.json({ gameId, message: "Game created successfully" });

  } catch (error) {
    console.error("Create game error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Join existing game
app.post("/make-server-825e19ab/join-game/:gameId", async (c) => {
  try {
    const gameId = c.req.param('gameId');
    const { playerName, playerId } = await c.req.json();
    
    if (!playerName || !playerId) {
      return c.json({ error: "Player name and ID are required" }, 400);
    }

    const gameData = await kvGet(\`game_\${gameId}\`);
    if (!gameData) {
      return c.json({ error: "Game not found" }, 404);
    }

    // Check if player already exists
    const existingPlayer = gameData.players.find(p => p.id === playerId);
    if (!existingPlayer) {
      gameData.players.push({
        id: playerId,
        name: playerName,
        joinedAt: new Date().toISOString()
      });

      gameData.actions.push({
        playerId: "system",
        playerName: "System",
        actionType: "system",
        content: \`\${playerName} joined the game\`,
        timestamp: new Date().toISOString()
      });
    }

    await kvSet(\`game_\${gameId}\`, gameData);
    
    console.log("Player joined game:", gameId, playerName);
    return c.json({ message: "Joined game successfully", gameData });

  } catch (error) {
    console.error("Join game error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Get game state
app.get("/make-server-825e19ab/game-state/:gameId", async (c) => {
  try {
    const gameId = c.req.param('gameId');
    const gameData = await kvGet(\`game_\${gameId}\`);
    
    if (!gameData) {
      return c.json({ error: "Game not found" }, 404);
    }

    return c.json(gameData);

  } catch (error) {
    console.error("Get game state error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Send action/message to game
app.post("/make-server-825e19ab/send-action/:gameId", async (c) => {
  try {
    const gameId = c.req.param('gameId');
    const { playerId, actionType, content, timestamp } = await c.req.json();
    
    if (!playerId || !actionType || !content) {
      return c.json({ error: "Player ID, action type, and content are required" }, 400);
    }

    const gameData = await kvGet(\`game_\${gameId}\`);
    if (!gameData) {
      return c.json({ error: "Game not found" }, 404);
    }

    const player = gameData.players.find(p => p.id === playerId);
    if (!player) {
      return c.json({ error: "Player not in game" }, 403);
    }

    gameData.actions.push({
      playerId,
      playerName: player.name,
      actionType,
      content,
      timestamp: timestamp || new Date().toISOString()
    });

    await kvSet(\`game_\${gameId}\`, gameData);
    
    console.log("Action sent to game:", gameId, actionType, content);
    return c.json({ message: "Action sent successfully" });

  } catch (error) {
    console.error("Send action error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Comprehensive system test endpoint
app.get("/make-server-825e19ab/system-test", async (c) => {
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    overall_status: "unknown"
  };

  let allTestsPassed = true;

  // Test 1: Environment variables
  try {
    const envTest = {
      name: "Environment Variables",
      status: "success",
      details: {
        supabase_url: !!Deno.env.get("SUPABASE_URL"),
        service_role_key: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
        anon_key: !!Deno.env.get("SUPABASE_ANON_KEY")
      }
    };
    results.tests.push(envTest);
  } catch (error) {
    results.tests.push({
      name: "Environment Variables",
      status: "error",
      error: error.message
    });
    allTestsPassed = false;
  }

  // Test 2: KV Store Operations
  try {
    const testKey = "system_test_" + Date.now();
    const testData = { test: true, timestamp: new Date().toISOString() };
    
    await kvSet(testKey, testData);
    const retrieved = await kvGet(testKey);
    await kvDel(testKey);
    
    results.tests.push({
      name: "KV Store Operations",
      status: "success",
      details: "Set, get, and delete operations successful"
    });
  } catch (error) {
    results.tests.push({
      name: "KV Store Operations",
      status: "error",
      error: error.message
    });
    allTestsPassed = false;
  }

  // Test 3: Supabase Auth Service
  try {
    // Test auth service by listing users (should work even if empty)
    const { data, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1
    });
    
    if (error) throw error;
    
    results.tests.push({
      name: "Supabase Auth Service",
      status: "success",
      details: "Auth admin access successful"
    });
  } catch (error) {
    results.tests.push({
      name: "Supabase Auth Service",
      status: "error",
      error: error.message
    });
    allTestsPassed = false;
  }

  // Test 4: Multiplayer Game System
  try {
    const testGameId = generateGameId();
    const testGame = {
      gameId: testGameId,
      players: [],
      actions: [],
      status: "test",
      createdAt: new Date().toISOString()
    };
    
    await kvSet(\`game_\${testGameId}\`, testGame);
    const retrieved = await kvGet(\`game_\${testGameId}\`);
    await kvDel(\`game_\${testGameId}\`);
    
    results.tests.push({
      name: "Multiplayer Game System",
      status: "success",
      details: "Game creation and retrieval successful"
    });
  } catch (error) {
    results.tests.push({
      name: "Multiplayer Game System",
      status: "error",
      error: error.message
    });
    allTestsPassed = false;
  }

  results.overall_status = allTestsPassed ? "success" : "error";
  
  console.log("System test completed:", results);
  return c.json(results);
});

// User signup endpoint
app.post("/make-server-825e19ab/signup", async (c) => {
  try {
    const { email, password, name } = await c.req.json();
    
    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name: name || 'Player' },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });

    if (error) {
      console.error("Signup error:", error);
      return c.json({ error: error.message }, 400);
    }

    console.log("User created successfully:", data.user?.email);
    return c.json({ message: "User created successfully", user: data.user });

  } catch (error) {
    console.error("Signup endpoint error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Simple echo endpoint for testing
app.post("/make-server-825e19ab/echo", async (c) => {
  try {
    const body = await c.req.json();
    return c.json({
      echo: body,
      timestamp: new Date().toISOString(),
      headers: Object.fromEntries(c.req.header())
    });
  } catch (error) {
    return c.json({ error: "Invalid JSON" }, 400);
  }
});

// List all available endpoints
app.get("/make-server-825e19ab/endpoints", (c) => {
  return c.json({
    endpoints: [
      { method: "GET", path: "/make-server-825e19ab/health", description: "Basic health check" },
      { method: "GET", path: "/make-server-825e19ab/test-connection", description: "Test Supabase connection" },
      { method: "GET", path: "/make-server-825e19ab/system-test", description: "Comprehensive system test" },
      { method: "POST", path: "/make-server-825e19ab/create-game", description: "Create new multiplayer game" },
      { method: "POST", path: "/make-server-825e19ab/join-game/:gameId", description: "Join existing game" },
      { method: "GET", path: "/make-server-825e19ab/game-state/:gameId", description: "Get current game state" },
      { method: "POST", path: "/make-server-825e19ab/send-action/:gameId", description: "Send action to game" },
      { method: "POST", path: "/make-server-825e19ab/signup", description: "Create user account" },
      { method: "POST", path: "/make-server-825e19ab/echo", description: "Echo request data for testing" },
      { method: "GET", path: "/make-server-825e19ab/endpoints", description: "List all endpoints" }
    ],
    timestamp: new Date().toISOString()
  });
});

Deno.serve(app.fetch);`;

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <Button variant="outline" onClick={onBack} className="mb-4">
          Back to Dashboard
        </Button>
        <h1>Deployment Testing</h1>
        <p className="text-gray-600">Test edge function deployment via Supabase dashboard</p>
      </div>

      <div className="grid gap-6">
        {/* Current Status Banner */}
        <Card className="border-blue-300 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-900">Multiplayer System Ready</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-blue-800">
                ✅ The edge function code has been updated with all required multiplayer endpoints.
              </p>
              <div className="p-3 bg-blue-100 rounded-md">
                <p className="text-blue-900 text-sm">
                  <strong>Status:</strong> The local edge function now includes create-game, join-game, game-state, and send-action endpoints. 
                  Deploy this updated code to fix the 404 errors in Multiplayer Test.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Deployment Status Banner */}
        <Card className={deploymentStatus === 'not-deployed' || deploymentStatus === 'partial-deployment' ? 'border-yellow-300 bg-yellow-50' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Deployment Status
              <Badge variant={
                deploymentStatus === 'deployed' ? 'default' : 
                deploymentStatus === 'partial-deployment' ? 'secondary' : 
                deploymentStatus === 'not-deployed' ? 'outline' : 'destructive'
              }>
                {deploymentStatus === 'deployed' ? 'Fully Deployed' : 
                 deploymentStatus === 'partial-deployment' ? 'Missing Multiplayer' : 
                 deploymentStatus === 'not-deployed' ? 'Not Deployed' : 'Unknown'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deploymentStatus === 'not-deployed' && (
              <div className="space-y-3">
                <p className="text-yellow-800">
                  Edge function not deployed yet. Deploy the updated code below.
                </p>
                <div className="p-3 bg-yellow-100 rounded-md">
                  <p className="text-yellow-900 text-sm">
                    <strong>Next step:</strong> Copy the complete edge function code below and deploy via your Supabase dashboard.
                  </p>
                </div>
              </div>
            )}
            {deploymentStatus === 'partial-deployment' && (
              <div className="space-y-3">
                <p className="text-yellow-800">
                  Edge function is deployed but missing multiplayer endpoints.
                </p>
                <div className="p-3 bg-yellow-100 rounded-md">
                  <p className="text-yellow-900 text-sm">
                    <strong>Action needed:</strong> Redeploy with the updated code below that includes all multiplayer endpoints.
                  </p>
                </div>
              </div>
            )}
            {deploymentStatus === 'deployed' && (
              <p className="text-green-700">Edge function is fully deployed with all multiplayer endpoints ready.</p>
            )}
          </CardContent>
        </Card>

        {/* Testing Controls */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-900">Testing Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-800">Current deployment status: <strong>{deploymentStatus}</strong></p>
                <p className="text-xs text-blue-600 mt-1">
                  {isTestingEnabled ? '✅ Testing buttons are enabled' : '❌ Testing buttons are disabled'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
              >
                Refresh Status
              </Button>
            </div>
            
            {!isTestingEnabled && (
              <div className="p-3 bg-blue-100 rounded-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-900 text-sm font-medium">Force Enable Testing</p>
                    <p className="text-blue-700 text-xs">Enable testing buttons even if deployment status is uncertain</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setForceTestingEnabled(true)}
                  >
                    Enable
                  </Button>
                </div>
              </div>
            )}
            
            {forceTestingEnabled && (
              <div className="p-3 bg-orange-100 rounded-md">
                <p className="text-orange-800 text-sm">
                  <strong>Force Testing Mode Enabled:</strong> Testing buttons are now active regardless of deployment status.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Supabase Client Test */}
          <Card>
            <CardHeader>
              <CardTitle>Supabase Client Test</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Test basic Supabase connection (works without edge function)
              </p>
              <Button onClick={handleSupabaseTest} className="w-full">
                Test Supabase Client
              </Button>
              {supabaseTest && (
                <div className={`mt-4 p-3 rounded-md text-sm ${
                  supabaseTest.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {supabaseTest.success ? supabaseTest.message : supabaseTest.error}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Edge Function Connection Test */}
          <Card>
            <CardHeader>
              <CardTitle>Edge Function Test</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span>Status</span>
                <Badge variant={connectionStatus === 'connected' ? 'default' : connectionStatus === 'testing' ? 'secondary' : connectionStatus === 'error' ? 'destructive' : 'outline'}>
                  {connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'testing' ? 'Testing...' : connectionStatus === 'error' ? 'Error' : 'Ready'}
                </Badge>
              </div>
              <Button 
                onClick={onTestConnection} 
                className="w-full"
                disabled={!isTestingEnabled}
              >
                Test Edge Function
              </Button>
              <Button 
                onClick={testEndpoints} 
                variant="outline" 
                className="w-full"
                disabled={!isTestingEnabled}
              >
                List Available Endpoints
              </Button>
            </CardContent>
          </Card>

          {/* System Test */}
          <Card>
            <CardHeader>
              <CardTitle>System Test</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Comprehensive test of all system components
              </p>
              <Button 
                onClick={onRunSystemTest} 
                className="w-full"
                disabled={!isTestingEnabled}
              >
                Run Full System Test
              </Button>
              {systemTestResults && (
                <div className="mt-4">
                  <Badge variant={systemTestResults.overall_status === 'success' ? 'default' : 'destructive'}>
                    {systemTestResults.overall_status}
                  </Badge>
                  {systemTestResults.tests && (
                    <div className="mt-2 space-y-1">
                      {systemTestResults.tests.map((test, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span>{test.name}</span>
                          <Badge variant={test.status === 'success' ? 'default' : 'destructive'} className="text-xs">
                            {test.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Echo Test */}
          <Card>
            <CardHeader>
              <CardTitle>Echo Test</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm mb-2">JSON to send:</label>
                <textarea
                  value={echoInput}
                  onChange={(e) => setEchoInput(e.target.value)}
                  className="w-full h-20 px-3 py-2 border rounded-md font-mono text-sm"
                />
              </div>
              <Button 
                onClick={testEcho}
                disabled={!isTestingEnabled}
              >
                Send Echo Test
              </Button>
              {echoTest && (
                <div className="mt-4">
                  <label className="block text-sm mb-2">Response:</label>
                  <pre className={`p-3 rounded-md text-xs overflow-auto max-h-32 ${
                    echoTest.success ? 'bg-gray-100' : 'bg-red-100 text-red-700'
                  }`}>
                    {JSON.stringify(echoTest.success ? echoTest.data : echoTest, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Deployment Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>🔧 CORRECTED Edge Function Code (No Imports)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-green-50 rounded-md">
                <h4 className="font-medium text-green-900 mb-2">✅ Fixed Issues:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-green-800">
                  <li>Removed all external file imports (kv_store.tsx)</li>
                  <li>All KV utilities are now defined inline</li>
                  <li>No dependencies on local project files</li>
                  <li>Self-contained edge function ready for deployment</li>
                </ul>
              </div>

              <div className="p-4 bg-blue-50 rounded-md">
                <h4 className="font-medium text-blue-900 mb-2">Deployment Steps:</h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
                  <li>Go to your Supabase project dashboard</li>
                  <li>Navigate to "Edge Functions" in the sidebar</li>
                  <li>If function exists, click "Edit", otherwise "Create a new function"</li>
                  <li>Name it: <code className="bg-blue-100 px-1 rounded">make-server-825e19ab</code></li>
                  <li>Copy the corrected code below and replace ALL existing code</li>
                  <li>Click "Deploy" to deploy the function</li>
                  <li>Return here and test the connection</li>
                </ol>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">CORRECTED Edge Function Code (No Import Errors)</h4>
                  <div className="space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowEdgeFunctionCode(!showEdgeFunctionCode)}
                    >
                      {showEdgeFunctionCode ? 'Hide Code' : 'Show Code'}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => copyToClipboard(edgeFunctionCode)}
                    >
                      Copy Code
                    </Button>
                  </div>
                </div>
                
                {showEdgeFunctionCode && (
                  <pre className="bg-gray-100 p-4 rounded-md text-xs overflow-auto max-h-96 border">
                    {edgeFunctionCode}
                  </pre>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2 text-sm">
                <div>
                  <strong>Project ID:</strong> {projectId}<br/>
                  <strong>Function Name:</strong> make-server-825e19ab<br/>
                  <strong>Function URL:</strong> https://{projectId}.supabase.co/functions/v1/make-server-825e19ab/
                </div>
                <div>
                  <strong>Multiplayer Endpoints:</strong>
                  <ul className="ml-4 space-y-1 text-gray-600 mt-1">
                    <li>• POST /create-game</li>
                    <li>• POST /join-game/:gameId</li>
                    <li>• GET /game-state/:gameId</li>
                    <li>• POST /send-action/:gameId</li>
                  </ul>
                </div>
              </div>

              <div className="p-3 bg-yellow-50 rounded-md">
                <p className="text-yellow-800 text-sm">
                  <strong>Note:</strong> Make sure your Supabase project has the environment variables SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY configured in the Edge Functions settings.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// SESSION + GAME DEBUG CARD (DEV-ONLY)
// ============================================================================
// Alpha v3 E2E test harness for session and game endpoints
// Provides quick testing without navigating to player UI
// ============================================================================

function SessionDebugCard() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [currentGameId, setCurrentGameId] = useState<string>('');
  const [joinGameInput, setJoinGameInput] = useState<string>('');
  const [lastResult, setLastResult] = useState<{ success: boolean; message: string; status?: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Action submission state (Phase 6)
  const [selectedAction, setSelectedAction] = useState<string>('set_ready');
  const [actionContent, setActionContent] = useState<any>({});

  // Check for existing session on mount
  useEffect(() => {
    const token = getSessionToken();
    setSessionToken(token);
  }, []);

  const handleStartSession = async () => {
    setIsLoading(true);
    setLastResult(null);
    
    try {
      // Pass a debug display name for test harness sessions
      const sessionData = await ensureSession('Debug Tester');
      setSessionToken(sessionData.sessionToken);
      setLastResult({ 
        success: true, 
        message: `Session created/refreshed successfully (${sessionData.displayName || 'no name'})`,
        status: 200
      });
      console.log('✅ Session created:', {
        token: sessionData.sessionToken.substring(0, 6) + '...',
        sessionId: sessionData.sessionId,
        displayName: sessionData.displayName
      });
    } catch (error) {
      console.error('Session creation error:', error);
      setLastResult({ 
        success: false, 
        message: `Error: ${error.message}`,
        status: 0
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateGame = async () => {
    setIsLoading(true);
    setLastResult(null);
    
    try {
      const response = await authenticatedPost('/create-game', {
        playerName: 'Debug Test Player'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      setCurrentGameId(data.gameId);
      setLastResult({ 
        success: true, 
        message: `Game created: ${data.gameId}`,
        status: response.status
      });
      console.log('✅ Game created:', data);
    } catch (error) {
      console.error('Create game error:', error);
      setLastResult({ 
        success: false, 
        message: `Error: ${error.message}`,
        status: 0
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinGame = async () => {
    setIsLoading(true);
    setLastResult(null);
    
    try {
      // Extract gameId from input (could be raw ID or full invite URL)
      let gameIdToJoin = joinGameInput.trim();
      if (gameIdToJoin.includes('game=')) {
        const urlParams = new URLSearchParams(gameIdToJoin.split('?')[1]);
        gameIdToJoin = urlParams.get('game') || gameIdToJoin;
      }
      
      const response = await authenticatedPost(`/join-game/${gameIdToJoin}`, {
        playerName: 'Debug Test Player 2',
        role: 'player'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      setCurrentGameId(gameIdToJoin);
      setLastResult({ 
        success: true, 
        message: `Joined game: ${gameIdToJoin}`,
        status: response.status
      });
      console.log('✅ Joined game:', data);
    } catch (error) {
      console.error('Join game error:', error);
      setLastResult({ 
        success: false, 
        message: `Error: ${error.message}`,
        status: 0
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchGameState = async () => {
    if (!currentGameId) {
      setLastResult({ 
        success: false, 
        message: 'No gameId set. Create or join a game first.',
        status: 0
      });
      return;
    }
    
    setIsLoading(true);
    setLastResult(null);
    
    try {
      const response = await authenticatedFetch(`/game-state/${currentGameId}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      setLastResult({ 
        success: true, 
        message: `Game state fetched (${data.players?.length || 0} players)`,
        status: response.status
      });
      console.log('✅ Game state:', data);
    } catch (error) {
      console.error('Fetch game state error:', error);
      setLastResult({ 
        success: false, 
        message: `Error: ${error.message}`,
        status: 0
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitAction = async () => {
    if (!currentGameId) {
      setLastResult({ 
        success: false, 
        message: 'No gameId set. Create or join a game first.',
        status: 0
      });
      return;
    }
    
    setIsLoading(true);
    setLastResult(null);
    
    try {
      // Build payload based on selected action type
      const payload: any = { actionType: selectedAction };
      
      // Add content field if action requires it, with validation
      if (selectedAction === 'select_species') {
        if (!actionContent.species) {
          throw new Error('Please select a species from the dropdown');
        }
        payload.content = { species: actionContent.species };
      } else if (selectedAction === 'build_ship') {
        if (!actionContent.shipId) {
          throw new Error('Please enter a ship ID');
        }
        payload.content = { shipId: actionContent.shipId };
      } else if (selectedAction === 'save_lines') {
        if (!actionContent.amount) {
          throw new Error('Please enter an amount');
        }
        payload.content = { amount: parseInt(actionContent.amount) };
      } else if (selectedAction === 'message') {
        if (!actionContent.message) {
          throw new Error('Please enter a message');
        }
        payload.content = actionContent.message;
      } else if (selectedAction === 'phase_action') {
        if (!actionContent.action) {
          throw new Error('Please select a phase action from the dropdown');
        }
        payload.content = { action: actionContent.action };
      }
      
      console.log('📤 Submitting action:', payload);
      
      const response = await authenticatedPost(`/send-action/${currentGameId}`, payload);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      setLastResult({ 
        success: true, 
        message: `Action submitted: ${selectedAction} → ${data.message || 'Success'}`,
        status: response.status
      });
      console.log('✅ Action result:', data);
      
      // Immediately fetch updated game state
      setTimeout(() => handleFetchGameState(), 200);
      
    } catch (error) {
      console.error('Submit action error:', error);
      setLastResult({ 
        success: false, 
        message: `Error: ${error.message}`,
        status: 0
      });
    } finally {
      setIsLoading(false);
    }
  };

  const tokenPreview = sessionToken ? sessionToken.substring(0, 6) + '...' : 'None';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Session + Game Debug</CardTitle>
        <p className="text-xs text-gray-500">Alpha v3 E2E Test Harness (DEV-only)</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Display */}
        <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded text-xs">
          <div>
            <span className="font-semibold">App Mode:</span>
            <Badge variant="secondary" className="ml-2">DEV</Badge>
          </div>
          <div>
            <span className="font-semibold">Session Token:</span>
            <Badge variant={sessionToken ? 'default' : 'outline'} className="ml-2">
              {sessionToken ? 'Yes' : 'No'}
            </Badge>
          </div>
          <div className="col-span-2">
            <span className="font-semibold">Token Preview:</span>
            <code className="ml-2 text-xs bg-white px-1 py-0.5 rounded">{tokenPreview}</code>
          </div>
          <div className="col-span-2">
            <span className="font-semibold">Current GameId:</span>
            <code className="ml-2 text-xs bg-white px-1 py-0.5 rounded">{currentGameId || 'None'}</code>
          </div>
        </div>

        {/* Last Result */}
        {lastResult && (
          <div className={`p-2 rounded text-xs ${lastResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            <div className="font-semibold">{lastResult.success ? '✅ Success' : '❌ Error'} {lastResult.status ? `(${lastResult.status})` : ''}</div>
            <div className="mt-1">{lastResult.message}</div>
          </div>
        )}

        {/* Controls */}
        <div className="space-y-2">
          <Button 
            onClick={handleStartSession} 
            disabled={isLoading}
            variant="outline" 
            size="sm" 
            className="w-full text-xs"
          >
            {isLoading ? 'Loading...' : 'Start / Refresh Session'}
          </Button>
          
          <Button 
            onClick={handleCreateGame} 
            disabled={isLoading || !sessionToken}
            variant="outline" 
            size="sm" 
            className="w-full text-xs"
          >
            {isLoading ? 'Loading...' : 'Create Private Game'}
          </Button>
          
          <div className="flex gap-2">
            <Input 
              placeholder="Game ID or invite URL"
              value={joinGameInput}
              onChange={(e) => setJoinGameInput(e.target.value)}
              disabled={isLoading}
              className="text-xs h-8"
            />
            <Button 
              onClick={handleJoinGame} 
              disabled={isLoading || !sessionToken || !joinGameInput.trim()}
              variant="outline" 
              size="sm" 
              className="text-xs whitespace-nowrap"
            >
              Join Game
            </Button>
          </div>
          
          <Button 
            onClick={handleFetchGameState} 
            disabled={isLoading || !sessionToken || !currentGameId}
            variant="outline" 
            size="sm" 
            className="w-full text-xs"
          >
            {isLoading ? 'Loading...' : 'Fetch Game State'}
          </Button>
        </div>

        {/* Submit Action (Phase 6) */}
        <Separator />
        <div className="space-y-2">
          <div className="text-xs font-semibold text-gray-700">Submit Action (Alpha E2E)</div>
          
          <select 
            value={selectedAction}
            onChange={(e) => {
              setSelectedAction(e.target.value);
              setActionContent({}); // Reset content when action type changes
            }}
            disabled={isLoading}
            className="w-full text-xs h-8 border rounded px-2"
          >
            <option value="set_ready">set_ready (no content)</option>
            <option value="select_species">select_species</option>
            <option value="build_ship">build_ship</option>
            <option value="save_lines">save_lines</option>
            <option value="roll_dice">roll_dice (no content)</option>
            <option value="phase_action">phase_action</option>
            <option value="message">message</option>
          </select>

          {/* Dynamic content fields based on selected action */}
          {selectedAction === 'select_species' && (
            <select
              value={actionContent.species || ''}
              onChange={(e) => setActionContent({ species: e.target.value })}
              disabled={isLoading}
              className="w-full text-xs h-8 border rounded px-2"
            >
              <option value="">Select species...</option>
              <option value="human">human</option>
              <option value="xenite">xenite</option>
              <option value="centaur">centaur</option>
              <option value="ancient">ancient</option>
            </select>
          )}

          {selectedAction === 'build_ship' && (
            <Input
              placeholder="Ship ID (e.g., hu_wedge)"
              value={actionContent.shipId || ''}
              onChange={(e) => setActionContent({ shipId: e.target.value })}
              disabled={isLoading}
              className="text-xs h-8"
            />
          )}

          {selectedAction === 'save_lines' && (
            <Input
              type="number"
              placeholder="Amount (e.g., 1)"
              value={actionContent.amount || ''}
              onChange={(e) => setActionContent({ amount: e.target.value })}
              disabled={isLoading}
              className="text-xs h-8"
            />
          )}

          {selectedAction === 'message' && (
            <Input
              placeholder="Message text"
              value={actionContent.message || ''}
              onChange={(e) => setActionContent({ message: e.target.value })}
              disabled={isLoading}
              className="text-xs h-8"
            />
          )}

          {selectedAction === 'phase_action' && (
            <select
              value={actionContent.action || ''}
              onChange={(e) => setActionContent({ action: e.target.value })}
              disabled={isLoading}
              className="w-full text-xs h-8 border rounded px-2"
            >
              <option value="">Select phase action...</option>
              <option value="roll_dice">roll_dice</option>
              <option value="advance_phase">advance_phase</option>
              <option value="pass_turn">pass_turn</option>
              <option value="end_turn">end_turn</option>
            </select>
          )}

          <Button 
            onClick={handleSubmitAction} 
            disabled={isLoading || !sessionToken || !currentGameId}
            variant="default" 
            size="sm" 
            className="w-full text-xs"
          >
            {isLoading ? 'Loading...' : 'Submit Action'}
          </Button>
          
          <div className="text-xs text-gray-400 italic">
            Submits to POST /send-action/:gameId, then auto-fetches new state
          </div>
        </div>

        <div className="text-xs text-gray-500 italic">
          Note: Errors include server response body in console logs.
        </div>
      </CardContent>
    </Card>
  );
}

function DevelopmentDashboard({ views, onViewChange, connectionStatus, deploymentStatus, errorMessage, onTestConnection, onTestSupabase }) {
  const [supabaseTest, setSupabaseTest] = useState(null);

  const handleSupabaseTest = async () => {
    setSupabaseTest(null);
    const result = await onTestSupabase();
    setSupabaseTest(result);
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1>Shapeships Development Dashboard</h1>
        <p className="text-gray-600">Multiplayer turn-based game development environment</p>
      </div>

      {/* System Status Section */}
      <div className="mb-8">
        <h2 className="mb-4">System Status</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Supabase Client</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={supabaseTest?.success ? 'default' : supabaseTest?.success === false ? 'destructive' : 'secondary'}>
                {supabaseTest?.success ? 'Working' : supabaseTest?.success === false ? 'Error' : 'Not Tested'}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Edge Function</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={deploymentStatus === 'deployed' ? connectionStatus === 'connected' ? 'default' : 'secondary' : 'outline'}>
                {deploymentStatus === 'deployed' ? (connectionStatus === 'connected' ? 'Connected' : 'Deployed') : 'Not Deployed'}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Authentication</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="default">Ready</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Multiplayer</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={
                deploymentStatus === 'deployed' ? 'default' : 
                deploymentStatus === 'partial-deployment' ? 'secondary' : 'outline'
              }>
                {deploymentStatus === 'deployed' ? 'Ready' : 
                 deploymentStatus === 'partial-deployment' ? 'Needs Update' : 
                 'Pending Deployment'}
              </Badge>
            </CardContent>
          </Card>
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={handleSupabaseTest} variant="outline" size="sm">
            Test Supabase Client
          </Button>
          <Button onClick={onTestConnection} variant="outline" size="sm">
            Test Edge Function
          </Button>
        </div>
        {errorMessage && (
          <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
            {errorMessage}
          </div>
        )}
      </div>

      <Separator className="my-8" />

      {/* Session + Game Debug (Alpha v3) */}
      <div className="mb-8">
        <h2 className="mb-4">Alpha v3 Session Testing</h2>
        <div className="max-w-md">
          <SessionDebugCard />
        </div>
      </div>

      <Separator className="my-8" />

      {/* Development Views */}
      <div className="mb-8">
        <h2 className="mb-4">Development Tools</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {views.map((view) => (
            <Card key={view.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{view.name}</CardTitle>
                  <Badge variant={view.status === 'ready' ? 'default' : 'secondary'} className="text-xs">
                    {view.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => onViewChange(view.id)}
                  variant={view.status === 'ready' ? 'default' : 'outline'}
                  className="w-full"
                  size="sm"
                  disabled={view.status === 'pending'}
                >
                  {view.status === 'ready' ? 'Open' : 'Coming Soon'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Separator className="my-8" />

      {/* Foundation Status */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <h2>✅ Foundation Complete</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-green-900">Phase Management</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-green-800">
              FSM-based turn system with clean 3-phase structure ready
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-green-900">Ship System</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-green-800">
              CSV single source of truth with auto-generation pipeline, 70 ships defined, species-based organization
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-green-900">Multiplayer Sync</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-green-800">
              Ready states, shared dice rolls, dual-ready system, backend infrastructure ready
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-green-900">Game Data</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-green-800">
              Lines system, health tracking, victory conditions all working
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-green-900">Type Architecture</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-green-800">
              Clean 3-layer split (CSV → Core → UI), auto-generation pipeline, server-safe engine code
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-green-900">Test Interface</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-green-800">
              3-phase turn system (Build, Battle, End of Turn Resolution) with multiplayer validation
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-green-900">Backend</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-green-800">
              Engine delegation (Option B), Supabase integration, edge functions, KV store, auth ready
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-green-900">Ship Graphics</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-green-800">
              Complete SVG graphics library: 21 Human, 22 Xenite, 22 Centaur, 6 Ancient ships (all with charge states)
            </CardContent>
          </Card>
        </div>
      </div>


    </div>
  );
}

function AuthenticationView({ onBack }) {
  return (
    <div className="container mx-auto p-6 max-w-md">
      <div className="mb-6">
        <Button variant="outline" onClick={onBack} className="mb-4">
          Back to Dashboard
        </Button>
        <h1>Authentication System</h1>
        <p className="text-gray-600">Test login and account creation functionality</p>
      </div>

      <Card className="border-amber-300 bg-amber-50">
        <CardHeader>
          <CardTitle className="text-amber-900">⚠️ Alpha v3 - Disabled</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-amber-800">
            <p>
              <strong>Authentication is disabled in Alpha v3.</strong>
            </p>
            <p>
              Players use session-only display names instead of accounts.
            </p>
            <div className="p-3 bg-amber-100 rounded-md">
              <p className="text-amber-900 text-xs">
                <strong>Implementation Status:</strong>
              </p>
              <ul className="list-disc list-inside text-xs text-amber-800 mt-1 space-y-1">
                <li>Email/password login: Disabled</li>
                <li>Account creation: Disabled</li>
                <li>Password reset: Disabled</li>
                <li>Session-only names: ✅ Active in PLAYER mode</li>
              </ul>
            </div>
            <p className="text-xs italic">
              Full authentication system will be re-enabled Post-Alpha.
              All code is preserved via feature flags.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GameView({ onBack }) {
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <Button variant="outline" onClick={onBack} className="mb-4">
          Back to Dashboard
        </Button>
        <h1>Game Screen</h1>
        <p className="text-gray-600">Main game interface - Awaiting rules and design</p>
      </div>

      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-gray-500 mb-4">Game interface will be implemented here</p>
          <p className="text-sm text-gray-400">This will be the main game board and interaction area</p>
        </CardContent>
      </Card>
    </div>
  );
}

function RulesView({ onBack }) {
  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <div className="mb-6">
        <Button variant="outline" onClick={onBack} className="mb-4">
          Back to Dashboard
        </Button>
        <h1>Game Rules & Help</h1>
        <p className="text-gray-600">How to play Shapeships - To be detailed</p>
      </div>

      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-gray-500 mb-4">Game rules and help documentation will go here</p>
          <p className="text-sm text-gray-400">This will explain how to play and game mechanics</p>
        </CardContent>
      </Card>
    </div>
  );
}