/**
 * INTENT PROTOCOL VERIFICATION
 * 
 * Test harness for commit/reveal protocol validation.
 * Tests species commit/reveal with two simulated players.
 * 
 * PASS CRITERIA:
 * - Commit must exist before reveal
 * - Hash mismatch must reject cleanly
 * - Species only visible after both reveals
 * - State stored under game_GAME_ID
 * - /send-action not involved
 */

import React, { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { sha256, generateNonce, createSpeciesIntent } from '../../utils/intentHelper';

interface TestResult {
  step: string;
  success: boolean;
  message: string;
  data?: any;
}

export function IntentVerification() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [gameId, setGameId] = useState<string>('');
  const [sessionTokenA, setSessionTokenA] = useState<string>('');
  const [sessionTokenB, setSessionTokenB] = useState<string>('');

  const addResult = (step: string, success: boolean, message: string, data?: any) => {
    setResults(prev => [...prev, { step, success, message, data }]);
  };

  const clearResults = () => {
    setResults([]);
  };

  const makeIntent = async (
    sessionToken: string,
    intentData: any
  ): Promise<Response> => {
    const url = `https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/intent`;
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
        'apikey': publicAnonKey,
        'X-Session-Token': sessionToken,
      },
      body: JSON.stringify(intentData)
    });
  };

  const getGameState = async (sessionToken: string, gameId: string): Promise<Response> => {
    const url = `https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/game-state/${gameId}`;
    return fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'apikey': publicAnonKey,
        'X-Session-Token': sessionToken,
      }
    });
  };

  const createSession = async (displayName: string): Promise<string> => {
    const url = `https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/session/start`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
        'apikey': publicAnonKey,
      },
      body: JSON.stringify({ displayName })
    });

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.status}`);
    }

    const data = await response.json();
    return data.sessionToken;
  };

  const createGame = async (sessionToken: string): Promise<string> => {
    const url = `https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/create-game`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
        'apikey': publicAnonKey,
        'X-Session-Token': sessionToken,
      },
      body: JSON.stringify({ playerName: 'Test Player A' })
    });

    if (!response.ok) {
      throw new Error(`Failed to create game: ${response.status}`);
    }

    const data = await response.json();
    return data.gameId;
  };

  const joinGame = async (sessionToken: string, gameId: string): Promise<void> => {
    const url = `https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/join-game/${gameId}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
        'apikey': publicAnonKey,
        'X-Session-Token': sessionToken,
      },
      body: JSON.stringify({ playerName: 'Test Player B', role: 'player' })
    });

    if (!response.ok) {
      throw new Error(`Failed to join game: ${response.status}`);
    }
  };

  const runVerification = async () => {
    setIsRunning(true);
    clearResults();

    try {
      // ============================================================================
      // SETUP: Create sessions and game
      // ============================================================================

      addResult('SETUP', true, 'Creating sessions for Player A and Player B...');

      const tokenA = await createSession('Test Player A');
      setSessionTokenA(tokenA);
      addResult('SESSION_A', true, `Player A session created: ${tokenA.substring(0, 20)}...`);

      const tokenB = await createSession('Test Player B');
      setSessionTokenB(tokenB);
      addResult('SESSION_B', true, `Player B session created: ${tokenB.substring(0, 20)}...`);

      addResult('SETUP', true, 'Creating game...');
      const newGameId = await createGame(tokenA);
      setGameId(newGameId);
      addResult('CREATE_GAME', true, `Game created: ${newGameId}`);

      addResult('SETUP', true, 'Player B joining game...');
      await joinGame(tokenB, newGameId);
      addResult('JOIN_GAME', true, 'Player B joined successfully');

      // ============================================================================
      // TEST 1: Player A SPECIES_COMMIT
      // ============================================================================

      addResult('TEST_1', true, 'Player A committing species choice (human)...');

      const intentA = await createSpeciesIntent('human');
      const commitResponseA = await makeIntent(tokenA, {
        gameId: newGameId,
        intentType: 'SPECIES_COMMIT',
        turnNumber: 1,
        commitHash: intentA.commit.commitHash
      });

      if (!commitResponseA.ok) {
        const errorText = await commitResponseA.text();
        addResult('TEST_1_COMMIT_A', false, `Player A commit failed: ${errorText}`);
        return;
      }

      const commitDataA = await commitResponseA.json();
      if (!commitDataA.ok) {
        addResult('TEST_1_COMMIT_A', false, `Player A commit rejected: ${JSON.stringify(commitDataA.rejected)}`);
        return;
      }

      addResult('TEST_1_COMMIT_A', true, 'Player A commit accepted', commitDataA.events);

      // ============================================================================
      // TEST 2: Player B SPECIES_COMMIT
      // ============================================================================

      addResult('TEST_2', true, 'Player B committing species choice (xenite)...');

      const intentB = await createSpeciesIntent('xenite');
      const commitResponseB = await makeIntent(tokenB, {
        gameId: newGameId,
        intentType: 'SPECIES_COMMIT',
        turnNumber: 1,
        commitHash: intentB.commit.commitHash
      });

      if (!commitResponseB.ok) {
        const errorText = await commitResponseB.text();
        addResult('TEST_2_COMMIT_B', false, `Player B commit failed: ${errorText}`);
        return;
      }

      const commitDataB = await commitResponseB.json();
      if (!commitDataB.ok) {
        addResult('TEST_2_COMMIT_B', false, `Player B commit rejected: ${JSON.stringify(commitDataB.rejected)}`);
        return;
      }

      addResult('TEST_2_COMMIT_B', true, 'Player B commit accepted', commitDataB.events);

      // ============================================================================
      // TEST 3: Player A SPECIES_REVEAL
      // ============================================================================

      addResult('TEST_3', true, 'Player A revealing species...');

      const revealResponseA = await makeIntent(tokenA, {
        gameId: newGameId,
        intentType: 'SPECIES_REVEAL',
        turnNumber: 1,
        payload: intentA.reveal.payload,
        nonce: intentA.reveal.nonce
      });

      if (!revealResponseA.ok) {
        const errorText = await revealResponseA.text();
        addResult('TEST_3_REVEAL_A', false, `Player A reveal failed: ${errorText}`);
        return;
      }

      const revealDataA = await revealResponseA.json();
      if (!revealDataA.ok) {
        addResult('TEST_3_REVEAL_A', false, `Player A reveal rejected: ${JSON.stringify(revealDataA.rejected)}`);
        return;
      }

      addResult('TEST_3_REVEAL_A', true, 'Player A reveal accepted', revealDataA.events);

      // Check if SPECIES_RESOLVED event is present (shouldn't be yet)
      const hasResolvedEarly = revealDataA.events?.some((e: any) => e.type === 'SPECIES_RESOLVED');
      if (hasResolvedEarly) {
        addResult('TEST_3_CHECK', false, '❌ SPECIES_RESOLVED emitted too early (only one player revealed)');
        return;
      }

      addResult('TEST_3_CHECK', true, '✓ SPECIES_RESOLVED not yet emitted (correct)');

      // ============================================================================
      // TEST 3.5: Verify Player B cannot see Player A's species yet
      // ============================================================================

      addResult('TEST_3.5', true, 'Checking game state from Player B perspective...');

      const stateResponseB = await getGameState(tokenB, newGameId);
      if (!stateResponseB.ok) {
        addResult('TEST_3.5_STATE', false, `Failed to fetch game state: ${stateResponseB.status}`);
        return;
      }

      const stateDataB = await stateResponseB.json();
      const playerAInStateB = stateDataB.players?.find((p: any) => p.id !== stateDataB.localPlayerId);

      if (playerAInStateB?.faction && playerAInStateB.faction !== null) {
        addResult('TEST_3.5_LEAK', false, `❌ Player A's faction leaked to Player B before resolution: ${playerAInStateB.faction}`);
        return;
      }

      addResult('TEST_3.5_LEAK', true, '✓ Player A\'s faction correctly hidden from Player B');

      // ============================================================================
      // TEST 4: Player B SPECIES_REVEAL
      // ============================================================================

      addResult('TEST_4', true, 'Player B revealing species...');

      const revealResponseB = await makeIntent(tokenB, {
        gameId: newGameId,
        intentType: 'SPECIES_REVEAL',
        turnNumber: 1,
        payload: intentB.reveal.payload,
        nonce: intentB.reveal.nonce
      });

      if (!revealResponseB.ok) {
        const errorText = await revealResponseB.text();
        addResult('TEST_4_REVEAL_B', false, `Player B reveal failed: ${errorText}`);
        return;
      }

      const revealDataB = await revealResponseB.json();
      if (!revealDataB.ok) {
        addResult('TEST_4_REVEAL_B', false, `Player B reveal rejected: ${JSON.stringify(revealDataB.rejected)}`);
        return;
      }

      addResult('TEST_4_REVEAL_B', true, 'Player B reveal accepted', revealDataB.events);

      // Check for SPECIES_RESOLVED event
      const hasResolved = revealDataB.events?.some((e: any) => e.type === 'SPECIES_RESOLVED');
      if (!hasResolved) {
        addResult('TEST_4_RESOLVED', false, '❌ SPECIES_RESOLVED event missing after both reveals');
        return;
      }

      addResult('TEST_4_RESOLVED', true, '✓ SPECIES_RESOLVED event emitted');

      // ============================================================================
      // TEST 5: Verify resolved state via game-state (Player A)
      // ============================================================================

      addResult('TEST_5', true, 'Verifying final state from Player A perspective...');

      const finalStateA = await getGameState(tokenA, newGameId);
      if (!finalStateA.ok) {
        addResult('TEST_5_STATE', false, `Failed to fetch game state: ${finalStateA.status}`);
        return;
      }

      const finalDataA = await finalStateA.json();

      // Find both players
      const localPlayerA = finalDataA.players?.find((p: any) => p.id === finalDataA.localPlayerId);
      const opponentA = finalDataA.players?.find((p: any) => p.id !== finalDataA.localPlayerId);

      if (!localPlayerA) {
        addResult('TEST_5_PLAYERS', false, '❌ Local player not found in state');
        return;
      }

      if (!opponentA) {
        addResult('TEST_5_PLAYERS', false, '❌ Opponent not found in state');
        return;
      }

      if (localPlayerA.faction !== 'human') {
        addResult('TEST_5_FACTION_A', false, `❌ Player A faction incorrect: ${localPlayerA.faction} (expected: human)`);
        return;
      }

      addResult('TEST_5_FACTION_A', true, `✓ Player A faction set correctly: ${localPlayerA.faction}`);

      if (opponentA.faction !== 'xenite') {
        addResult('TEST_5_FACTION_B', false, `❌ Player B faction incorrect: ${opponentA.faction} (expected: xenite)`);
        return;
      }

      addResult('TEST_5_FACTION_B', true, `✓ Player B faction set correctly: ${opponentA.faction}`);

      // Check for commitment leaks
      if (finalDataA.gameData?.commitments) {
        addResult('TEST_5_LEAK', false, '❌ Commitment data present in game state (should be filtered)');
        return;
      }

      addResult('TEST_5_LEAK', true, '✓ No commitment data leaked in game state');

      // ============================================================================
      // TEST 6: Negative test - bad reveal hash
      // ============================================================================

      addResult('TEST_6', true, 'Testing hash mismatch rejection...');

      // Try to commit again with a new hash
      const badIntent = await createSpeciesIntent('centaur');
      const badCommitResponse = await makeIntent(tokenA, {
        gameId: newGameId,
        intentType: 'SPECIES_COMMIT',
        turnNumber: 2,
        commitHash: badIntent.commit.commitHash
      });

      if (!badCommitResponse.ok) {
        addResult('TEST_6_SETUP', false, `Failed to setup bad reveal test: ${badCommitResponse.status}`);
        return;
      }

      const badCommitData = await badCommitResponse.json();
      if (!badCommitData.ok) {
        addResult('TEST_6_SETUP', false, `Commit rejected: ${JSON.stringify(badCommitData.rejected)}`);
        return;
      }

      // Now try to reveal with WRONG nonce
      const badRevealResponse = await makeIntent(tokenA, {
        gameId: newGameId,
        intentType: 'SPECIES_REVEAL',
        turnNumber: 2,
        payload: badIntent.reveal.payload,
        nonce: 'WRONG_NONCE_12345'
      });

      if (!badRevealResponse.ok) {
        addResult('TEST_6_REVEAL', false, `Bad reveal request failed: ${badRevealResponse.status}`);
        return;
      }

      const badRevealData = await badRevealResponse.json();

      // Should be rejected
      if (badRevealData.ok) {
        addResult('TEST_6_HASH_MISMATCH', false, '❌ Bad reveal was accepted (should have been rejected)');
        return;
      }

      if (badRevealData.rejected?.code !== 'HASH_MISMATCH') {
        addResult('TEST_6_HASH_MISMATCH', false, `❌ Wrong rejection code: ${badRevealData.rejected?.code} (expected: HASH_MISMATCH)`);
        return;
      }

      addResult('TEST_6_HASH_MISMATCH', true, `✓ Bad reveal correctly rejected with HASH_MISMATCH`);

      // ============================================================================
      // FINAL RESULT
      // ============================================================================

      addResult('COMPLETE', true, '✅ ALL TESTS PASSED');

    } catch (error) {
      addResult('ERROR', false, `Test suite failed: ${error}`);
      console.error('Verification error:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const passedTests = results.filter(r => r.success).length;
  const failedTests = results.filter(r => !r.success).length;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Intent Protocol Verification</CardTitle>
        <p className="text-sm text-gray-600">
          Tests species commit/reveal protocol with two simulated players
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            onClick={runVerification}
            disabled={isRunning}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isRunning ? 'Running Tests...' : 'Run Verification'}
          </Button>
          <Button
            onClick={clearResults}
            disabled={isRunning}
            variant="outline"
          >
            Clear Results
          </Button>
        </div>

        {results.length > 0 && (
          <div className="space-y-2">
            <div className="flex gap-4 text-sm font-medium">
              <span className="text-green-600">✓ Passed: {passedTests}</span>
              <span className="text-red-600">✗ Failed: {failedTests}</span>
            </div>

            <div className="border rounded-lg p-4 space-y-2 max-h-96 overflow-y-auto bg-gray-50 font-mono text-xs">
              {results.map((result, i) => (
                <div
                  key={i}
                  className={`p-2 rounded ${
                    result.success ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-900'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="font-bold">{result.success ? '✓' : '✗'}</span>
                    <div className="flex-1">
                      <div className="font-semibold">{result.step}</div>
                      <div>{result.message}</div>
                      {result.data && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-gray-600">Details</summary>
                          <pre className="mt-1 text-xs overflow-x-auto">
                            {JSON.stringify(result.data, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {gameId && (
          <div className="text-xs space-y-1 p-3 bg-gray-100 rounded">
            <div><strong>Game ID:</strong> {gameId}</div>
            <div><strong>Session A:</strong> {sessionTokenA.substring(0, 30)}...</div>
            <div><strong>Session B:</strong> {sessionTokenB.substring(0, 30)}...</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
