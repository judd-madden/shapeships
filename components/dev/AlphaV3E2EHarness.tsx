import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Input } from '../ui/input';
import {
  getSessionToken,
  ensureSession,
  clearSession,
  authenticatedPost,
  authenticatedFetch,
} from '../../utils/sessionManager';

type ActionType = 'set_ready' | 'select_species' | 'build_ship' | 'save_lines' | 'roll_dice' | 'advance_phase' | 'message';
type Species = 'human' | 'xenite' | 'centaur' | 'ancient';

interface SessionMeta {
  sessionId: string;
  displayName?: string;
}

interface LastResult {
  success: boolean;
  message: string;
  statusCode?: number;
  data?: any;
}

// Helper functions for Response handling
async function readJsonOrText(res: Response): Promise<any> {
  const text = await res.text().catch(() => '');
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

async function requireOk(res: Response): Promise<any> {
  const data = await readJsonOrText(res);
  if (!res.ok) {
    const msg = typeof data === 'string' ? data : JSON.stringify(data);
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }
  return data;
}

export default function AlphaV3E2EHarness() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionMeta, setSessionMeta] = useState<SessionMeta | null>(null);
  const [gameId, setGameId] = useState<string>('');
  const [gameIdInput, setGameIdInput] = useState<string>('');
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  
  // Action submission state
  const [selectedAction, setSelectedAction] = useState<ActionType>('set_ready');
  const [speciesInput, setSpeciesInput] = useState<Species>('human');
  const [shipIdInput, setShipIdInput] = useState<string>('');
  const [saveLinesInput, setSaveLinesInput] = useState<string>('0');
  const [messageInput, setMessageInput] = useState<string>('');

  // Mount-time refresh: reflect existing session token
  useEffect(() => {
    const existingToken = getSessionToken();
    setSessionToken(existingToken);
    
    if (existingToken) {
      // Token exists, try to resolve session metadata
      ensureSession()
        .then((result) => {
          setSessionMeta({
            sessionId: result.sessionId,
            displayName: result.displayName,
          });
          setLastResult({
            success: true,
            message: 'Session restored from localStorage',
            data: result,
          });
        })
        .catch((error: any) => {
          // Don't crash the UI on error
          setLastResult({
            success: false,
            message: `Session restore failed: ${error.message}`,
          });
        });
    }
  }, []);

  // Helper to normalize game ID from input (handles URLs)
  const normalizeGameIdFromInput = (input: string): string => {
    const trimmed = input.trim();
    if (trimmed.includes('game=')) {
      try {
        const url = new URL(trimmed.startsWith('http') ? trimmed : `https://example.com${trimmed}`);
        return url.searchParams.get('game') || trimmed;
      } catch {
        // If URL parsing fails, try simple regex
        const match = trimmed.match(/[?&]game=([^&]+)/);
        return match ? match[1] : trimmed;
      }
    }
    return trimmed;
  };

  // Session controls
  const handleStartSession = async () => {
    try {
      setLastResult({ success: true, message: 'Starting session...' });
      
      const result = await ensureSession('Debug Tester');
      const token = getSessionToken();
      
      setSessionToken(token);
      setSessionMeta({
        sessionId: result.sessionId,
        displayName: result.displayName,
      });
      
      console.log('[AlphaV3E2E] Session started:', {
        sessionId: result.sessionId,
        displayName: result.displayName,
      });
      
      setLastResult({
        success: true,
        message: 'Session started successfully',
        data: result,
      });
    } catch (error: any) {
      setLastResult({
        success: false,
        message: `Session start failed: ${error.message}`,
      });
    }
  };

  const handleClearSession = () => {
    clearSession();
    setSessionToken(null);
    setSessionMeta(null);
    setLastResult({
      success: true,
      message: 'Session cleared (local only)',
    });
  };

  // Game controls
  const handleCreateGame = async () => {
    try {
      setLastResult({ success: true, message: 'Creating game...' });
      
      const res = await authenticatedPost('/create-game', {
        playerName: 'Debug Test Player',
      });
      
      const data = await requireOk(res);
      
      // Extract gameId from response
      const createdGameId = data.gameId || data.game?.gameId || data.id;
      
      if (!createdGameId) {
        throw new Error('No gameId in server response');
      }
      
      console.log('[AlphaV3E2E] Game created:', createdGameId);
      
      setGameId(createdGameId);
      setGameIdInput(createdGameId);
      
      // Auto-fetch game state using known gameId (don't wait for state update)
      try {
        const stateRes = await authenticatedFetch(`/game-state/${createdGameId}`, {
          method: 'GET',
        });
        const stateData = await requireOk(stateRes);
        console.log('[AlphaV3E2E] Game state after create:', stateData);
      } catch (fetchError: any) {
        console.warn('[AlphaV3E2E] Failed to fetch game state after create:', fetchError.message);
      }
      
      setLastResult({
        success: true,
        message: `Game created: ${createdGameId}`,
        data: data,
      });
    } catch (error: any) {
      setLastResult({
        success: false,
        message: `Create game failed: ${error.message}`,
      });
    }
  };

  const handleJoinGame = async () => {
    if (!gameIdInput.trim()) {
      setLastResult({
        success: false,
        message: 'No game ID provided',
      });
      return;
    }

    try {
      const normalizedGameId = normalizeGameIdFromInput(gameIdInput);
      setLastResult({ success: true, message: 'Joining game...' });
      
      const res = await authenticatedPost(`/join-game/${normalizedGameId}`, {
        playerName: 'Debug Test Player 2',
        role: 'player',
      });
      
      const data = await requireOk(res);
      
      console.log('[AlphaV3E2E] Joined game:', normalizedGameId);
      
      setGameId(normalizedGameId);
      
      // Auto-fetch game state using known gameId (don't wait for state update)
      try {
        const stateRes = await authenticatedFetch(`/game-state/${normalizedGameId}`, {
          method: 'GET',
        });
        const stateData = await requireOk(stateRes);
        console.log('[AlphaV3E2E] Game state after join:', stateData);
      } catch (fetchError: any) {
        console.warn('[AlphaV3E2E] Failed to fetch game state after join:', fetchError.message);
      }
      
      setLastResult({
        success: true,
        message: `Joined game: ${normalizedGameId}`,
        data: data,
      });
    } catch (error: any) {
      setLastResult({
        success: false,
        message: `Join game failed: ${error.message}`,
      });
    }
  };

  const handleFetchGameState = async () => {
    if (!gameId) {
      setLastResult({
        success: false,
        message: 'No game ID set. Create or join a game first.',
      });
      return;
    }

    try {
      setLastResult({ success: true, message: 'Fetching game state...' });
      
      const res = await authenticatedFetch(`/game-state/${gameId}`, {
        method: 'GET',
      });
      
      const data = await requireOk(res);
      
      console.log('[AlphaV3E2E] Game state:', data);
      
      // Derive player count from array or object
      let playerCount = 0;
      if (data.players) {
        if (Array.isArray(data.players)) {
          playerCount = data.players.length;
        } else {
          playerCount = Object.keys(data.players).length;
        }
      }
      
      setLastResult({
        success: true,
        message: `Game state fetched. ${playerCount} player(s)`,
        data: data,
      });
    } catch (error: any) {
      setLastResult({
        success: false,
        message: `Fetch game state failed: ${error.message}`,
      });
    }
  };

  const handleSubmitAction = async () => {
    if (!gameId) {
      setLastResult({
        success: false,
        message: 'No game ID set. Create or join a game first.',
      });
      return;
    }

    try {
      setLastResult({ success: true, message: 'Submitting action...' });
      
      // Build payload based on action type
      const payload: any = {
        actionType: selectedAction,
      };
      
      // Add action-specific content
      if (selectedAction === 'select_species') {
        payload.content = { species: speciesInput };
      } else if (selectedAction === 'build_ship') {
        if (!shipIdInput.trim()) {
          setLastResult({
            success: false,
            message: 'Ship ID required for build_ship action',
          });
          return;
        }
        payload.content = { shipId: shipIdInput.trim() };
      } else if (selectedAction === 'save_lines') {
        const amount = parseInt(saveLinesInput, 10);
        if (isNaN(amount)) {
          setLastResult({
            success: false,
            message: 'Invalid number for save_lines',
          });
          return;
        }
        payload.content = { amount };
      } else if (selectedAction === 'message') {
        if (!messageInput.trim()) {
          setLastResult({
            success: false,
            message: 'Message text required for message action',
          });
          return;
        }
        payload.content = messageInput.trim();
      }
      // set_ready, roll_dice, advance_phase have no content
      
      const res = await authenticatedPost(`/send-action/${gameId}`, payload);
      
      const data = await requireOk(res);
      
      setLastResult({
        success: true,
        message: `Action submitted: ${selectedAction}`,
        data: data,
      });
      
      // Auto-fetch game state after successful action
      setTimeout(() => {
        handleFetchGameState();
      }, 200);
    } catch (error: any) {
      setLastResult({
        success: false,
        message: `Submit action failed: ${error.message}`,
      });
    }
  };

  // Happy path: select species → set ready → fetch game state
  const runHappyPath = async (species: Species) => {
    if (!gameId) {
      setLastResult({
        success: false,
        message: 'No game ID set. Create or join a game first.',
      });
      return;
    }

    try {
      setLastResult({ success: true, message: 'Running happy path...' });

      // Step 1: Submit select_species action
      const selectSpeciesRes = await authenticatedPost(`/send-action/${gameId}`, {
        actionType: 'select_species',
        content: { species },
      });
      await requireOk(selectSpeciesRes);

      // Step 2: Submit set_ready action
      const setReadyRes = await authenticatedPost(`/send-action/${gameId}`, {
        actionType: 'set_ready',
      });
      await requireOk(setReadyRes);

      // Step 3: Fetch game state
      const fetchRes = await authenticatedFetch(`/game-state/${gameId}`, {
        method: 'GET',
      });
      const gameState = await requireOk(fetchRes);

      console.log('[AlphaV3E2E] Happy path complete:', gameState);

      setLastResult({
        success: true,
        message: `Happy path complete: species=${species}, ready=true`,
        data: gameState,
      });
    } catch (error: any) {
      setLastResult({
        success: false,
        message: `Happy path failed: ${error.message}`,
      });
    }
  };

  const tokenPreview = sessionToken
    ? `${sessionToken.substring(0, 6)}...`
    : 'None';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Alpha v3 E2E Test Harness</h1>
        <p className="text-sm text-gray-600">
          Uses <code className="bg-gray-100 px-1 rounded">X-Session-Token</code> for identity. Never sends playerId.
        </p>
      </div>

      {/* Status Display */}
      <Card>
        <CardHeader>
          <CardTitle>Session Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Session Token:</span>
            <Badge variant={sessionToken ? 'default' : 'outline'}>
              {sessionToken ? 'Present' : 'None'}
            </Badge>
            <span className="text-xs text-gray-500 font-mono">{tokenPreview}</span>
          </div>
          
          {sessionMeta && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Session ID:</span>
                <span className="text-sm text-gray-700 font-mono">{sessionMeta.sessionId}</span>
              </div>
              {sessionMeta.displayName && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Display Name:</span>
                  <span className="text-sm text-gray-700">{sessionMeta.displayName}</span>
                </div>
              )}
            </>
          )}
          
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Current Game ID:</span>
            <span className="text-sm text-gray-700 font-mono">{gameId || 'None'}</span>
          </div>
        </CardContent>
      </Card>

      {/* Last Result Banner */}
      {lastResult && (
        <Card className={lastResult.success ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-2">
              <Badge variant={lastResult.success ? 'default' : 'destructive'}>
                {lastResult.success ? 'Success' : 'Error'}
              </Badge>
              <div className="flex-1">
                <p className="text-sm font-medium">{lastResult.message}</p>
                {lastResult.statusCode && (
                  <p className="text-xs text-gray-600 mt-1">Status: {lastResult.statusCode}</p>
                )}
                {lastResult.data && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-600 cursor-pointer">Show response data</summary>
                    <pre className="text-xs bg-white p-2 rounded mt-1 overflow-auto max-h-40">
                      {JSON.stringify(lastResult.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Session Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Session Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button onClick={handleStartSession}>
              Start / Refresh Session
            </Button>
            <Button onClick={handleClearSession} variant="outline">
              Clear Session (local)
            </Button>
          </div>
          <p className="text-xs text-gray-600">
            Session tokens are stored in localStorage and sent via <code className="bg-gray-100 px-1 rounded">X-Session-Token</code> header.
          </p>
        </CardContent>
      </Card>

      <Separator />

      {/* Game Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Game Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Button onClick={handleCreateGame}>
              Create Private Game
            </Button>
            <p className="text-xs text-gray-600 mt-1">
              Creates a new game and sets it as the current game ID.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <label className="text-sm font-medium">Game ID or Invite URL</label>
            <Input
              value={gameIdInput || ''}
              onChange={(e) => setGameIdInput(e.target.value)}
              placeholder="game-id-123 or https://example.com?game=game-id-123"
              className="font-mono text-sm"
            />
            <div className="flex gap-2">
              <Button onClick={handleJoinGame}>
                Join Game
              </Button>
              <Button onClick={handleFetchGameState} variant="outline">
                Fetch Game State
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Submit Action */}
      <Card>
        <CardHeader>
          <CardTitle>Submit Action</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Actions (Happy Path) */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Quick Actions (Happy Path)</label>
            <p className="text-xs text-gray-600 mb-2">
              One-click: Select Species → Set Ready → Fetch Game State
            </p>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => runHappyPath('human')} variant="outline" size="sm">
                Human → Ready
              </Button>
              <Button onClick={() => runHappyPath('xenite')} variant="outline" size="sm">
                Xenite → Ready
              </Button>
              <Button onClick={() => runHappyPath('centaur')} variant="outline" size="sm">
                Centaur → Ready
              </Button>
              <Button onClick={() => runHappyPath('ancient')} variant="outline" size="sm">
                Ancient → Ready
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <label className="text-sm font-medium">Action Type</label>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value as ActionType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="set_ready">set_ready</option>
              <option value="select_species">select_species</option>
              <option value="build_ship">build_ship</option>
              <option value="save_lines">save_lines</option>
              <option value="roll_dice">roll_dice</option>
              <option value="advance_phase">advance_phase</option>
              <option value="message">message</option>
            </select>
          </div>

          {/* Dynamic inputs based on action type */}
          {selectedAction === 'select_species' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Species</label>
              <select
                value={speciesInput}
                onChange={(e) => setSpeciesInput(e.target.value as Species)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="human">human</option>
                <option value="xenite">xenite</option>
                <option value="centaur">centaur</option>
                <option value="ancient">ancient</option>
              </select>
            </div>
          )}

          {selectedAction === 'build_ship' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Ship ID</label>
              <Input
                value={shipIdInput || ''}
                onChange={(e) => setShipIdInput(e.target.value)}
                placeholder="e.g., DEF, FIG, INT"
                className="font-mono text-sm"
              />
            </div>
          )}

          {selectedAction === 'save_lines' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount</label>
              <Input
                type="number"
                value={saveLinesInput || '0'}
                onChange={(e) => setSaveLinesInput(e.target.value)}
                placeholder="0"
                min="0"
                className="font-mono text-sm"
              />
            </div>
          )}

          {selectedAction === 'message' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Message</label>
              <Input
                value={messageInput || ''}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Enter your message"
                className="text-sm"
              />
            </div>
          )}

          <Button onClick={handleSubmitAction}>
            Submit Action
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}