import React, { useState, useEffect } from 'react';
import { Button } from './components/ui/button';

// Force rebuild - fixed intents.ts species verification
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Separator } from './components/ui/separator';
import { Toaster } from './components/ui/sonner';
import { Input } from './components/ui/input';
import { supabase } from './utils/supabase/client';
import { projectId, publicAnonKey } from './utils/supabase/info';
import { ensureSession, authenticatedFetch, getSessionToken, clearSession } from './utils/sessionManager';
import ScreenManager from './components/ScreenManager';
import GraphicsTest from './components/dev/GraphicsTest';
import GameScreen from './game/display/GameScreen';
import { IntentVerification } from './game/test/IntentVerification';
import { usePlayer } from './game/hooks/usePlayer';
import { BuildKitShowcase } from './components/dev/BuildKitShowcase';
import { runFullSimulation } from './game/engine/battle/BattleSimulationHarness';
import AlphaV3E2EHarness from './components/dev/AlphaV3E2EHarness';
import { ActionPanelsGallery } from './components/dev/ActionPanelsGallery';

// Feature flags for legacy harnesses
const ENABLE_BATTLE_SIM = false; // Legacy harness disabled. Real engine is server/engine_shared.

// Dashboard view type
type DashboardViewId = 'deployment' | 'auth' | 'alphaE2E' | 'intentVerification' | 'battleSimulation' | 'graphicsTest' | 'buildKit' | 'gameScreen' | 'actionPanelsGallery';

// App view mode
type ViewMode = 'dashboard' | 'playerMode' | 'gameFullscreen';

// Dashboard entries configuration
const DASHBOARD_ENTRIES: Array<{ id: DashboardViewId; label: string; alphaDisabled?: boolean }> = [
  { id: 'deployment', label: 'Deployment Test' },
  { id: 'auth', label: 'Authentication', alphaDisabled: true },
  { id: 'alphaE2E', label: 'Alpha v3 E2E Harness' },
  { id: 'intentVerification', label: 'Intent Verification' },
  { id: 'battleSimulation', label: 'Battle Simulation', alphaDisabled: !ENABLE_BATTLE_SIM },
  { id: 'graphicsTest', label: 'Graphics Test' },
  { id: 'buildKit', label: 'Build Kit' },
  { id: 'gameScreen', label: 'Game Screen' },
  { id: 'actionPanelsGallery', label: 'Action Panels Gallery' },
];

// URL helper functions
function readDashboardViewFromUrl(): DashboardViewId {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view') as DashboardViewId | null;
  
  // Validate view is a known dashboard view
  const validViews: DashboardViewId[] = ['deployment', 'auth', 'alphaE2E', 'intentVerification', 'battleSimulation', 'graphicsTest', 'buildKit', 'gameScreen', 'actionPanelsGallery'];
  
  if (view && validViews.includes(view)) {
    return view;
  }
  
  return 'deployment';
}

function readGameIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('game');
}

function readViewModeFromUrl(): ViewMode {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  
  // If view=gameScreenFull, always fullscreen
  if (view === 'gameScreenFull') {
    return 'gameFullscreen';
  }
  
  // Backward compatibility: view=gameScreen with game param → fullscreen
  if (view === 'gameScreen') {
    const game = params.get('game');
    if (game && game.length > 0) {
      return 'gameFullscreen';
    }
  }
  
  // Default to dashboard
  return 'dashboard';
}

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>(() => readViewModeFromUrl());
  const [currentView, setCurrentView] = useState<DashboardViewId>(() => readDashboardViewFromUrl());
  const [deploymentStatus, setDeploymentStatus] = useState<'unknown' | 'ready' | 'error'>('unknown');
  const [gameId, setGameId] = useState<string | null>(() => readGameIdFromUrl());
  
  // Centralized player management
  const { player, isReady: playerReady } = usePlayer();

  useEffect(() => {
    // Initial status check
    checkDeploymentStatus();

    // Keep state in sync when user uses browser back/forward
    const onPopState = () => {
      setCurrentView(readDashboardViewFromUrl());
      setGameId(readGameIdFromUrl());
      setViewMode(readViewModeFromUrl());
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const checkDeploymentStatus = async () => {
    const url = `https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/health`;

    console.log('[DeployCheck] start', { url, projectId });

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });

      console.log('[DeployCheck] response', {
        ok: response.ok,
        status: response.status,
      });

      if (response.ok) {
        const body = await response.json().catch(() => null);
        console.log('[DeployCheck] body', body);
        setDeploymentStatus('ready');
      } else {
        const text = await response.text().catch(() => '');
        console.warn('[DeployCheck] non-OK body', text);
        setDeploymentStatus('error');
      }
    } catch (error) {
      console.error('[DeployCheck] failed', error);
      setDeploymentStatus('error');
    }
  };

  const setView = (viewId: DashboardViewId) => {
    const params = new URLSearchParams(window.location.search);
    params.set('view', viewId);

    // Preserve any existing ?game=... param
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, document.title, newUrl);

    // Update React state (this is what actually makes the UI change)
    setCurrentView(viewId);
  };

  const switchToDevMode = () => {
    setViewMode('dashboard');
    setGameId(null);
    setView('deployment');
  };

  const openGameBoardFullscreen = () => {
    // Only proceed if gameId exists
    if (!gameId) {
      return;
    }
    
    // Update URL to use view=gameScreenFull
    const params = new URLSearchParams(window.location.search);
    params.set('view', 'gameScreenFull');
    params.set('game', gameId); // Ensure game param is set
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, document.title, newUrl);
    
    // Switch to fullscreen mode
    setViewMode('gameFullscreen');
  };

  const returnToDashboard = () => {
    setViewMode('dashboard');
  };

  // Render full-screen GameBoard mode
  if (viewMode === 'gameFullscreen') {
    if (!playerReady) {
      return <div className="w-screen h-screen flex items-center justify-center">Loading player...</div>;
    }
    
    // If no gameId, show error screen with back button
    if (!gameId) {
      return (
        <div className="w-screen h-screen flex items-center justify-center bg-gray-50">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>No Game Loaded</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600">
                No gameId was provided. Please create a game or open an existing game from the dashboard.
              </p>
              <Button onClick={returnToDashboard} className="w-full">
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
    
    return (
      <div className="w-screen h-screen overflow-hidden">
        <GameScreen
          gameId={gameId}
          playerName={player!.name}
          onBack={returnToDashboard}
        />
      </div>
    );
  }

  // Render Player Mode (ScreenManager)
  if (viewMode === 'playerMode') {
    return <ScreenManager onSwitchToDevMode={switchToDevMode} />;
  }

  // Render Dashboard mode
  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster />
      
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-black">Shapeships Dev Dashboard</h1>
          <Button onClick={() => setViewMode('playerMode')}>
            Switch to Player Mode
          </Button>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar Navigation */}
        <div className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-73px)] p-4">
          <nav className="space-y-1">
            {DASHBOARD_ENTRIES.map((entry) => (
              <button
                key={entry.id}
                onClick={() => !entry.alphaDisabled && setView(entry.id)}
                disabled={entry.alphaDisabled}
                className={`w-full text-left px-4 py-2 rounded-md transition-colors ${
                  currentView === entry.id
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : entry.alphaDisabled
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {entry.label}
                {entry.alphaDisabled && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    Disabled
                  </Badge>
                )}
              </button>
            ))}
          </nav>

          {/* Deployment Status */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="text-sm font-medium text-gray-700 mb-2">Status</div>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  deploymentStatus === 'ready'
                    ? 'bg-green-500'
                    : deploymentStatus === 'error'
                    ? 'bg-red-500'
                    : 'bg-gray-400'
                }`}
              />
              <span className="text-sm text-gray-600">
                {deploymentStatus === 'ready'
                  ? 'Deployed'
                  : deploymentStatus === 'error'
                  ? 'Error'
                  : 'Checking...'}
              </span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          {currentView === 'deployment' && (
            <DeploymentTestView
              onBack={() => setView('deployment')}
              deploymentStatus={deploymentStatus}
              onTestConnection={checkDeploymentStatus}
            />
          )}
          
          {currentView === 'auth' && (
            <AuthenticationView onBack={() => setView('deployment')} />
          )}
          
          {currentView === 'alphaE2E' && (
            <div className="container mx-auto max-w-4xl">
              <Button onClick={() => setView('deployment')} className="mb-4">
                ← Back to Dashboard
              </Button>
              <AlphaV3E2EHarness />
            </div>
          )}
          
          {currentView === 'intentVerification' && (
            <div className="container mx-auto max-w-4xl">
              <Button onClick={() => setView('deployment')} className="mb-4">
                ← Back to Dashboard
              </Button>
              <IntentVerification />
            </div>
          )}
          
          {currentView === 'battleSimulation' && (
            <div className="container mx-auto max-w-4xl">
              <Button onClick={() => setView('deployment')} className="mb-4">
                ← Back to Dashboard
              </Button>
              <Card>
                <CardHeader>
                  <CardTitle>Battle Simulation Harness</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => {
                      console.log('Running full battle simulation...');
                      runFullSimulation();
                    }}
                  >
                    Run Full Simulation
                  </Button>
                  <p className="text-sm text-gray-700 mt-2">
                    <strong>Scenario:</strong> 2 players with various ships (Defenders, Fighters, Interceptor).
                    Tests automatic damage/healing and charge-based effects.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
          
          {currentView === 'graphicsTest' && (
            <div>
              <Button onClick={() => setView('deployment')} className="mb-4">
                ← Back to Dashboard
              </Button>
              <GraphicsTest />
            </div>
          )}
          
          {currentView === 'buildKit' && (
            <div>
              <Button onClick={() => setView('deployment')} className="mb-4">
                ← Back to Dashboard
              </Button>
              <BuildKitShowcase />
            </div>
          )}
          
          {currentView === 'gameScreen' && (
            <div className="container mx-auto max-w-4xl">
              <div className="space-y-4">
                <Button onClick={() => setView('deployment')} className="mb-4">
                  ← Back to Dashboard
                </Button>
                
                <CreateTestGameSection
                  player={player}
                  playerReady={playerReady}
                  gameId={gameId}
                  onGameCreated={(newGameId) => {
                    setGameId(newGameId);
                    // Update URL with view=gameScreenFull and game param
                    const params = new URLSearchParams(window.location.search);
                    params.set('view', 'gameScreenFull');
                    params.set('game', newGameId);
                    const newUrl = `${window.location.pathname}?${params.toString()}`;
                    window.history.pushState({}, document.title, newUrl);
                    // Open fullscreen
                    setViewMode('gameFullscreen');
                  }}
                />
                
                <SessionManagementSection
                  player={player}
                  playerReady={playerReady}
                />
                
                <Button onClick={openGameBoardFullscreen} size="lg" className="w-full" disabled={!gameId}>
                  Open GameBoard Full-Screen {gameId ? `(${gameId.substring(0, 8)}...)` : '(No Game)'}
                </Button>
                <Card>
                  <CardHeader>
                    <CardTitle>GameBoard Preview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600">
                      Click "Create Test Game" to create a new game on the server, or use "Open GameBoard Full-Screen" if you already have a gameId.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
          
          {currentView === 'actionPanelsGallery' && (
            <div className="container w-1200px">
              <Button onClick={() => setView('deployment')} className="mb-4">
                ← Back to Dashboard
              </Button>
              <ActionPanelsGallery />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Deployment Test View Component
function DeploymentTestView({ 
  onBack, 
  deploymentStatus, 
  onTestConnection 
}: { 
  onBack: () => void; 
  deploymentStatus: string;
  onTestConnection: () => void;
}) {
  const [echoTest, setEchoTest] = useState<{ success: boolean; data?: any; error?: string } | null>(null);
  const [echoInput, setEchoInput] = useState('{"test": "hello", "timestamp": "' + new Date().toISOString() + '"}');
  const [showEdgeFunctionCode, setShowEdgeFunctionCode] = useState(false);
  const [supabaseTest, setSupabaseTest] = useState<{ success: boolean; data?: any; error?: string } | null>(null);

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
    } catch (error: any) {
      setEchoTest({ success: false, error: error.message });
    }
  };

  const testEndpoints = async () => {
    const url = `https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/endpoints`;

    console.log('[Endpoints] start', { url });

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });

      const text = await response.text().catch(() => '');
      console.log('[Endpoints] response', { status: response.status, ok: response.ok, text });

      if (response.ok) {
        try {
          console.log('[Endpoints] parsed', JSON.parse(text));
        } catch {
          // ignore
        }
      }
    } catch (error) {
      console.error('[Endpoints] failed', error);
    }
  };

  const handleSupabaseTest = async () => {
    setSupabaseTest(null);
    try {
      const { data, error } = await supabase.from('kv_store_825e19ab').select('*').limit(1);
      
      if (error) {
        setSupabaseTest({ success: false, error: error.message });
      } else {
        setSupabaseTest({ success: true, data });
      }
    } catch (error: any) {
      setSupabaseTest({ success: false, error: error.message });
    }
  };

  const edgeFunctionCode = `// Minimal Hono server example
import { Hono } from 'npm:hono@3';
import { cors } from 'npm:hono/cors';

const app = new Hono();

// CORS middleware
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// Health check
app.get('/make-server-825e19ab/health', (c) => {
  return c.json({ 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Echo endpoint
app.post('/make-server-825e19ab/echo', async (c) => {
  const body = await c.req.json();
  return c.json({
    echo: body,
    receivedAt: new Date().toISOString()
  });
});

// List endpoints
app.get('/make-server-825e19ab/endpoints', (c) => {
  return c.json({
    endpoints: [
      { method: "GET", path: "/make-server-825e19ab/health", description: "Health check" },
      { method: "POST", path: "/make-server-825e19ab/echo", description: "Echo request data for testing" },
      { method: "GET", path: "/make-server-825e19ab/endpoints", description: "List all endpoints" }
    ],
    timestamp: new Date().toISOString()
  });
});

Deno.serve(app.fetch);`;

  return (
    <div className="container mx-auto max-w-6xl">
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
                <p className="text-sm font-mono text-blue-900">
                  Deployment Status: <strong>{deploymentStatus}</strong>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Tests */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Connection Tests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Button onClick={onTestConnection} className="mr-2">
                Test Health Endpoint
              </Button>
              <Button onClick={testEndpoints} variant="outline">
                List All Endpoints
              </Button>
            </div>
            
            <Separator />
            
            <div>
              <h3 className="font-semibold mb-2">Test Echo Endpoint</h3>
              <p className="text-sm text-gray-600 mb-2">Send JSON data to test round-trip:</p>
              <Input
                value={echoInput}
                onChange={(e) => setEchoInput(e.target.value)}
                placeholder='{"test": "data"}'
                className="mb-2 font-mono text-sm"
              />
              <Button onClick={testEcho}>Send Echo Request</Button>
              
              {echoTest && (
                <div className={`mt-2 p-3 rounded-md ${echoTest.success ? 'bg-green-50' : 'bg-red-50'}`}>
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(echoTest, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            
            <Separator />
            
            <div>
              <h3 className="font-semibold mb-2">Test Supabase Direct Client</h3>
              <p className="text-sm text-gray-600 mb-2">Query the database directly from the browser:</p>
              <Button onClick={handleSupabaseTest}>Test KV Store Access</Button>
              
              {supabaseTest && (
                <div className={`mt-2 p-3 rounded-md ${supabaseTest.success ? 'bg-green-50' : 'bg-red-50'}`}>
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(supabaseTest, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Edge Function Code Reference */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Edge Function Code Reference</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEdgeFunctionCode(!showEdgeFunctionCode)}
              >
                {showEdgeFunctionCode ? 'Hide' : 'Show'} Code
              </Button>
            </CardTitle>
          </CardHeader>
          {showEdgeFunctionCode && (
            <CardContent>
              <pre className="text-xs bg-gray-900 text-gray-100 p-4 rounded-md overflow-auto">
                {edgeFunctionCode}
              </pre>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}

// Authentication View (Placeholder)
function AuthenticationView({ onBack }: { onBack: () => void }) {
  return (
    <div className="container mx-auto p-6 max-w-md">
      <Button variant="outline" onClick={onBack} className="mb-4">
        Back to Dashboard
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Authentication</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            Authentication features are disabled in alpha. This will be enabled in a future release.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// Create Test Game Section
function CreateTestGameSection({
  player,
  playerReady,
  gameId,
  onGameCreated,
}: {
  player: any;
  playerReady: boolean;
  gameId: string | null;
  onGameCreated: (newGameId: string) => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const createTestGame = async () => {
    if (!playerReady) {
      setError('Player is not ready.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Only call ensureSession with player name if no token exists
      // This prevents session churn
      const existingToken = getSessionToken();
      if (!existingToken) {
        await ensureSession(player.name);
      } else {
        // Token exists, just ensure it's valid (no displayName = no clear)
        await ensureSession();
      }
      
      // Create game using authenticatedFetch
      const response = await authenticatedFetch('/create-game', {
        method: 'POST',
        body: JSON.stringify({
          playerName: player.name,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        onGameCreated(result.gameId);
      } else {
        const errorText = await response.text();
        setError(`HTTP ${response.status}: ${errorText}`);
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const copyGameUrl = () => {
    const currentUrl = window.location.href;
    navigator.clipboard.writeText(currentUrl);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Test Game</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          onClick={createTestGame}
          size="lg"
          className="w-full"
          disabled={isLoading || !playerReady}
        >
          {isLoading ? 'Creating...' : 'Create Test Game → Open GameScreen'}
        </Button>
        
        {gameId && (
          <div className="space-y-2">
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm font-medium text-green-900">Current gameId:</p>
              <p className="font-mono text-xs text-green-700 break-all">{gameId}</p>
            </div>
            <Button
              onClick={copyGameUrl}
              variant="outline"
              size="sm"
              className="w-full"
            >
              {copySuccess ? '✓ Copied!' : 'Copy Game URL'}
            </Button>
          </div>
        )}
        
        {error && (
          <div className="p-3 rounded-md bg-red-50 border border-red-200">
            <p className="text-sm font-medium text-red-900">Error:</p>
            <pre className="text-xs text-red-700 overflow-auto mt-1">{error}</pre>
          </div>
        )}
        
        {!playerReady && (
          <p className="text-sm text-gray-500">Waiting for player to be ready...</p>
        )}
      </CardContent>
    </Card>
  );
}

// Session Management Section (Dev-only)
function SessionManagementSection({
  player,
  playerReady,
}: {
  player: any;
  playerReady: boolean;
}) {
  const [displayName, setDisplayName] = useState(player?.name || '');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentToken, setCurrentToken] = useState(getSessionToken());

  // Update display name when player changes
  useEffect(() => {
    if (player?.name) {
      setDisplayName(player.name);
    }
  }, [player?.name]);

  // Update token display when it changes
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentToken(getSessionToken());
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const handleClearSession = () => {
    clearSession();
    setCurrentToken(null);
    setStatusMessage('Session cleared. Reload or create a session.');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleResetSession = async () => {
    if (!displayName.trim()) {
      setStatusMessage('Please enter a display name.');
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    try {
      // Clear existing session
      clearSession();
      
      // Create new session with display name
      await ensureSession(displayName.trim());
      
      // Update token display
      setCurrentToken(getSessionToken());
      
      setStatusMessage(`New session created as "${displayName.trim()}"`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (error: any) {
      setStatusMessage(`Error: ${error.message}`);
      setTimeout(() => setStatusMessage(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Session Management (Dev-only)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label htmlFor="session-display-name" className="text-sm font-medium text-gray-700 block mb-1">
            Session display name
          </label>
          <Input
            id="session-display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter display name"
            className="mb-2"
          />
        </div>
        
        <div className="flex gap-2">
          <Button
            onClick={handleClearSession}
            variant="outline"
            className="flex-1"
            disabled={isLoading}
          >
            Clear Session
          </Button>
          
          <Button
            onClick={handleResetSession}
            className="flex-1"
            disabled={isLoading || !displayName.trim()}
          >
            {isLoading ? 'Resetting...' : 'Reset Session (set name)'}
          </Button>
        </div>
        
        {statusMessage && (
          <div className="p-3 rounded-md bg-blue-50 border border-blue-200">
            <p className="text-sm text-blue-900">{statusMessage}</p>
          </div>
        )}
        
        {currentToken && (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
            <p className="text-xs font-medium text-gray-700 mb-1">Current token (truncated):</p>
            <p className="font-mono text-xs text-gray-600 break-all">
              {currentToken.substring(0, 40)}...
            </p>
          </div>
        )}
        
        {!currentToken && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-xs text-yellow-800">No session token. Next authenticated request will create one.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}