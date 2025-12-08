import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner@2.0.3';
import { useGameState } from '../hooks/useGameState';
import { getSpeciesById } from '../data/SpeciesData';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

// URL configuration - matches App.tsx settings
const LIVE_BASE_URL = 'https://semi-folk-76756080.figma.site';
const USE_LIVE_URL = true;

// Simplified game phases for testing
enum SimplePhase {
  SETUP = 'setup',
  DICE_ROLL = 'dice_roll',
  SHIP_BUILDING = 'ship_building',
  AUTOMATIC_POWERS = 'automatic_powers',
  HEALTH_RESOLUTION = 'health_resolution',
  END_OF_GAME = 'end_of_game'
}

interface GameTestInterfaceProps {
  gameId: string;
  playerId: string;
  playerName: string;
  onBack: () => void;
}

export default function GameTestInterface({ gameId, playerId, playerName, onBack }: GameTestInterfaceProps) {
  const [currentGameId, setCurrentGameId] = useState(gameId);
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [createGameError, setCreateGameError] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [roleSelected, setRoleSelected] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'player' | 'spectator'>('player');
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [preJoinGameInfo, setPreJoinGameInfo] = useState<any>(null);
  
  // Ref for auto-scrolling game log
  const gameLogRef = useRef<HTMLDivElement>(null);
  
  // Check URL parameters for game ID on mount and fetch game info
  useEffect(() => {
    if (!currentGameId) {
      const urlParams = new URLSearchParams(window.location.search);
      const gameParam = urlParams.get('game');
      if (gameParam && gameParam !== currentGameId) {
        setCurrentGameId(gameParam);
        setShowRoleSelection(true);
        
        // Fetch game info to show current state
        fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/game-state/${gameParam}`,
          {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
            },
          }
        )
          .then(response => response.json())
          .then(data => {
            setPreJoinGameInfo(data);
            // Auto-select spectator if game is full
            const activePlayers = data?.players?.filter(p => p.role === 'player') || [];
            if (activePlayers.length >= 2) {
              setSelectedRole('spectator');
            }
          })
          .catch(err => {
            console.error('Failed to fetch game info:', err);
          });
      }
    }
  }, []);
  
  // Separate useEffect for joining game
  useEffect(() => {
    if (currentGameId && !hasJoined && roleSelected) {
      console.log('Attempting to join game:', currentGameId, 'with player ID:', playerId, 'as role:', selectedRole);
      joinExistingGame(currentGameId, selectedRole);
    }
  }, [currentGameId, hasJoined, roleSelected, selectedRole]);

  // Auto-select role and join when gameId is present but no URL role selection needed
  useEffect(() => {
    if (currentGameId && !showRoleSelection && !roleSelected && !hasJoined) {
      setRoleSelected(true);
    }
  }, [currentGameId, showRoleSelection, roleSelected, hasJoined]);
  
  const { gameState, loading, error, sendAction } = useGameState(currentGameId, playerId);
  const [selectedShipToBuild, setSelectedShipToBuild] = useState('');
  const [selectedSpecies, setSelectedSpecies] = useState('human');
  const [message, setMessage] = useState('');

  // Get current player data
  const currentPlayer = gameState?.players?.find(p => p.id === playerId);
  const isSpectator = currentPlayer?.role === 'spectator';
  const activePlayers = gameState?.players?.filter(p => p.role === 'player') || [];
  const spectators = gameState?.players?.filter(p => p.role === 'spectator') || [];
  
  const opponent = activePlayers.find(p => p.id !== playerId);
  const playerShips = gameState?.gameData?.ships?.[playerId] || [];
  const opponentShips = opponent ? gameState?.gameData?.ships?.[opponent.id] || [] : [];

  // Get available ships for the selected species
  const species = getSpeciesById(selectedSpecies);
  const availableShips = species?.ships || [];

  // Simplified game state helpers
  const currentPhase = gameState?.gameData?.currentPhase || SimplePhase.SETUP;
  const turnNumber = gameState?.gameData?.turnNumber || 1;
  const diceRoll = gameState?.gameData?.diceRoll;

  const handleSelectSpecies = async () => {
    if (!selectedSpecies) return;
    
    await sendAction('select_species', {
      species: selectedSpecies
    });
  };

  const handleBuildShip = async () => {
    if (!selectedShipToBuild) return;
    
    await sendAction('build_ship', {
      shipId: selectedShipToBuild,
      quantity: 1
    });
    setSelectedShipToBuild('');
  };

  // Note: Dice rolling and phase advancement are now automatic
  // Only manual action is setting ready status in Ship Building phase

  const handleSetReady = async () => {
    await sendAction('set_ready', {
      ready: !currentPlayer?.isReady
    });
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    
    await sendAction('message', {
      content: message.trim()
    });
    setMessage('');
  };

  const createNewGame = async (role: 'player' | 'spectator') => {
    setIsCreatingGame(true);
    setCreateGameError('');
    
    try {
      console.log('Creating new game as:', role);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/create-game`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            playerName,
            playerId,
            role
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log('Game created successfully:', result);
        setCurrentGameId(result.gameId);
        setSelectedRole(role);
        setRoleSelected(true);
        setCreateGameError('');
        
        // Update URL with game ID and view parameter
        const newUrl = `${window.location.pathname}?game=${result.gameId}&view=game-test`;
        window.history.pushState({}, document.title, newUrl);
      } else {
        const errorText = await response.text();
        console.error('Failed to create game:', response.status, errorText);
        setCreateGameError(`Failed to create game (${response.status}): ${errorText}`);
      }
    } catch (err) {
      console.error('Network error creating game:', err);
      setCreateGameError(`Network error: ${err.message}`);
    } finally {
      setIsCreatingGame(false);
    }
  };

  const joinExistingGame = async (gameIdToJoin: string, role: 'player' | 'spectator') => {
    try {
      console.log('Joining game with:', { 
        gameId: gameIdToJoin, 
        playerId, 
        playerName,
        role
      });
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/join-game/${gameIdToJoin}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            playerName,
            playerId,
            role
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log('Successfully joined game:', result);
        
        // Check if the user was automatically set to spectator
        const joinedPlayer = result.gameData?.players?.find(p => p.id === playerId);
        if (joinedPlayer && role === 'player' && joinedPlayer.role === 'spectator') {
          toast.info('Game is full - you were automatically set as a spectator', {
            description: 'There are already 2 active players in this game.'
          });
        }
        
        setHasJoined(true);
        setCreateGameError('');
      } else {
        const errorText = await response.text();
        console.error('Failed to join game:', errorText);
        setCreateGameError(`Failed to join game: ${errorText}`);
      }
    } catch (err) {
      console.error('Error joining game:', err);
      setCreateGameError(`Error joining game: ${err.message}`);
    }
  };

  // Generate base URL
  const getBaseUrl = () => {
    if (USE_LIVE_URL && LIVE_BASE_URL !== 'https://your-published-app-url.com') {
      return LIVE_BASE_URL;
    }
    return `${window.location.origin}${window.location.pathname}`;
  };

  const copyGameUrl = async () => {
    const gameUrl = `${getBaseUrl()}?game=${currentGameId}&view=game-test`;
    try {
      await navigator.clipboard.writeText(gameUrl);
      toast.success('Game URL copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy URL:', err);
      toast.error('Failed to copy URL. Please copy manually.');
    }
  };

  const calculatePlayerStats = (ships: any[]) => {
    const stats = {
      totalShips: ships.length,
      defenders: ships.filter(s => s.shipId === 'defender').length,
      fighters: ships.filter(s => s.shipId === 'fighter').length
    };
    return stats;
  };

  const playerStats = calculatePlayerStats(playerShips);
  const opponentStats = calculatePlayerStats(opponentShips);

  // Auto-scroll game log when new actions are added
  useEffect(() => {
    if (gameLogRef.current) {
      gameLogRef.current.scrollTop = gameLogRef.current.scrollHeight;
    }
  }, [gameState?.actions?.length]);

  // Show role selection interface for URL joins
  if (currentGameId && showRoleSelection && !roleSelected) {
    const activePlayers = preJoinGameInfo?.players?.filter(p => p.role === 'player') || [];
    const spectators = preJoinGameInfo?.players?.filter(p => p.role === 'spectator') || [];
    const isGameFull = activePlayers.length >= 2;
    
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Button variant="outline" onClick={onBack} className="mb-4">
          Back to Dashboard
        </Button>
        <div className="mb-6">
          <h1>Join Game</h1>
          <p className="text-gray-600">Joining game: {currentGameId}</p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Choose Your Role</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Game Status Info */}
            {preJoinGameInfo && (
              <div className="p-3 rounded-md bg-blue-50 border border-blue-200 mb-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Game Status:</span>
                    <Badge variant={preJoinGameInfo.status === 'active' ? 'default' : 'secondary'}>
                      {preJoinGameInfo.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Players:</span>
                    <span>{activePlayers.length}/2</span>
                  </div>
                  {spectators.length > 0 && (
                    <div className="flex justify-between">
                      <span>Spectators:</span>
                      <span>{spectators.length}</span>
                    </div>
                  )}
                  {isGameFull && (
                    <div className="text-orange-700 mt-2">
                      ⚠️ Game is full - you can only join as a spectator
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Player: {playerName} (ID: {playerId})
              </p>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <input
                    type="radio"
                    id="join-as-player"
                    name="role"
                    value="player"
                    checked={selectedRole === 'player'}
                    onChange={() => setSelectedRole('player')}
                    disabled={isGameFull}
                    className="w-4 h-4"
                  />
                  <label 
                    htmlFor="join-as-player" 
                    className={`text-sm ${isGameFull ? 'text-gray-400' : ''}`}
                  >
                    <strong>Player</strong> - Actively participate in the game
                    {isGameFull && <span className="text-xs ml-2">(unavailable - game is full)</span>}
                  </label>
                </div>
                
                <div className="flex items-center space-x-3">
                  <input
                    type="radio"
                    id="join-as-spectator"
                    name="role"
                    value="spectator"
                    checked={selectedRole === 'spectator'}
                    onChange={() => setSelectedRole('spectator')}
                    className="w-4 h-4"
                  />
                  <label htmlFor="join-as-spectator" className="text-sm">
                    <strong>Spectator</strong> - Watch the game and chat
                  </label>
                </div>
              </div>
              
              <Button 
                onClick={() => {
                  setRoleSelected(true);
                  setShowRoleSelection(false);
                }}
                className="w-full mt-4"
              >
                Join as {selectedRole === 'player' ? 'Player' : 'Spectator'}
              </Button>
            </div>
            
            {createGameError && (
              <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">
                <strong>Error:</strong> {createGameError}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show game creation interface if no game ID
  if (!currentGameId) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Button variant="outline" onClick={onBack} className="mb-4">
          Back to Dashboard
        </Button>
        <div className="mb-6">
          <h1>Simplified Game Test Interface</h1>
          <p className="text-gray-600">Testing automatic turn cycle: Dice (auto) → Ship Building (both ready) → Powers (auto) → Health (auto)</p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Create Test Game</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Player: {playerName} (ID: {playerId})
              </p>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <input
                    type="radio"
                    id="create-as-player"
                    name="role"
                    value="player"
                    checked={selectedRole === 'player'}
                    onChange={() => setSelectedRole('player')}
                    className="w-4 h-4"
                  />
                  <label htmlFor="create-as-player" className="text-sm">
                    <strong>Player</strong> - Create game and participate actively
                  </label>
                </div>
                
                <div className="flex items-center space-x-3">
                  <input
                    type="radio"
                    id="create-as-spectator"
                    name="role"
                    value="spectator"
                    checked={selectedRole === 'spectator'}
                    onChange={() => setSelectedRole('spectator')}
                    className="w-4 h-4"
                  />
                  <label htmlFor="create-as-spectator" className="text-sm">
                    <strong>Spectator</strong> - Create game but only observe
                  </label>
                </div>
              </div>
              
              <Button 
                onClick={() => createNewGame(selectedRole)} 
                disabled={isCreatingGame}
                className="w-full mt-4"
              >
                {isCreatingGame ? 'Creating Game...' : `Create Game as ${selectedRole === 'player' ? 'Player' : 'Spectator'}`}
              </Button>
            </div>
            
            {createGameError && (
              <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">
                <strong>Error:</strong> {createGameError}
                <div className="mt-2">
                  <p className="text-xs">
                    This usually means the edge function isn't deployed yet. 
                    Please check the Deployment Test section.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if ((loading && !gameState) || (currentGameId && !roleSelected && !showRoleSelection)) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Button variant="outline" onClick={onBack} className="mb-4">
          Back to Dashboard
        </Button>
        <div className="text-center py-12">
          <p>Loading game...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Button variant="outline" onClick={onBack} className="mb-4">
          Back to Dashboard
        </Button>
        <Card className="border-red-300 bg-red-50">
          <CardContent className="p-6">
            <div className="space-y-3">
              <p className="text-red-800"><strong>Error:</strong> {error}</p>
              <Button 
                onClick={() => setCurrentGameId('')} 
                variant="outline" 
                size="sm"
              >
                Try Creating New Game
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <Button variant="outline" onClick={onBack} className="mb-4">
          Back to Dashboard
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1>Automatic Game Test Interface</h1>
            <p className="text-gray-600">Game: {currentGameId} | Player: {playerName}</p>
            <p className="text-xs text-gray-500">Turn {turnNumber} • Cycle: Dice Roll (auto) → Ship Building (both ready) → Automatic Powers (auto) → Health Resolution (auto)</p>
          </div>
          <div className="flex gap-2 items-center">
            <Badge variant={gameState?.status === 'active' ? 'default' : 'secondary'}>
              {gameState?.status || 'unknown'}
            </Badge>
            <Badge variant={isSpectator ? 'secondary' : 'default'}>
              {isSpectator ? 'Spectator' : 'Player'}
            </Badge>
            {!isSpectator && (
              <Badge variant={currentPlayer?.isReady ? 'default' : 'outline'}>
                {currentPlayer?.isReady ? 'Ready' : 'Not Ready'}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Game URL Sharing */}
      <Card className="mb-6 border-blue-200 bg-blue-50">
        <CardContent className="py-3">
          <div className="flex items-center gap-3">
            <span className="text-blue-900 whitespace-nowrap">🔗 Share Game</span>
            <input
              type="text"
              value={`${getBaseUrl()}?game=${currentGameId}&view=game-test`}
              readOnly
              className="flex-1 px-3 py-2 border rounded-md bg-white text-sm"
            />
            <Button 
              variant="default" 
              size="sm"
              onClick={copyGameUrl}
              className="whitespace-nowrap"
            >
              Copy
            </Button>
            <div className="flex items-center gap-3 text-xs text-blue-700 whitespace-nowrap">
              <span><strong>Players:</strong> {activePlayers.length}/2</span>
              {activePlayers.length === 1 && (
                <span className="text-blue-600">⏳</span>
              )}
              {activePlayers.length >= 2 && (
                <span className="text-green-600">✅</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Game Status Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Game Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Phase:</span>
                <Badge variant="secondary" className="text-xs">
                  {currentPhase.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Turn:</span>
                <span className="text-sm">{turnNumber}</span>
              </div>
              {diceRoll && (
                <div className="flex justify-between">
                  <span className="text-sm">Dice Roll:</span>
                  <span className="text-sm">🎲 {diceRoll}</span>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="text-sm">Active Players ({activePlayers.length}/2)</h4>
              {activePlayers.length > 0 ? (
                activePlayers.map((player) => (
                  <div key={player.id} className="flex items-center justify-between text-sm">
                    <span>{player.name} {player.id === playerId && '(You)'}</span>
                    <div className="flex gap-1">
                      <Badge variant={player.isReady ? 'default' : 'outline'} className="text-xs">
                        {player.isReady ? '✓' : '○'}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {player.faction || 'No Species'}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-500">No active players yet</p>
              )}
              
              {spectators.length > 0 && (
                <>
                  <h4 className="text-sm pt-2">Spectators ({spectators.length})</h4>
                  {spectators.map((player) => (
                    <div key={player.id} className="flex items-center justify-between text-sm">
                      <span>{player.name} {player.id === playerId && '(You)'}</span>
                      <Badge variant="secondary" className="text-xs">
                        Spectator
                      </Badge>
                    </div>
                  ))}
                </>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <Button 
                onClick={handleSetReady} 
                variant={currentPlayer?.isReady ? 'outline' : 'default'}
                size="sm" 
                className="w-full"
              >
                {currentPlayer?.isReady ? 'Set Not Ready' : 'Set Ready'}
              </Button>
              <Button 
                onClick={() => window.location.reload()} 
                variant="outline"
                size="sm" 
                className="w-full text-xs"
              >
                🔄 Refresh Game
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Player Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Your Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Role Status */}
            <div className="p-3 rounded-md bg-gray-50">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Role:</span>
                <Badge variant={isSpectator ? 'secondary' : 'default'}>
                  {isSpectator ? 'Spectator' : 'Active Player'}
                </Badge>
              </div>
            </div>

            {/* Species Display */}
            {!isSpectator && currentPlayer?.faction && (
              <div className="space-y-2">
                <h4 className="text-sm">Your Species</h4>
                <div className="p-2 bg-gray-50 rounded">
                  <Badge variant="default">{currentPlayer.faction.toUpperCase()}</Badge>
                </div>
              </div>
            )}

            {/* Player Resources */}
            {!isSpectator && (
              <div className="space-y-2">
                <h4 className="text-sm">Resources</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Health: {currentPlayer?.health || 25}/35</div>
                  <div>Lines: {currentPlayer?.lines || 0}</div>
                </div>
              </div>
            )}

            {/* Player Ships */}
            {!isSpectator && (
              <div className="space-y-2">
                <h4 className="text-sm">Your Ships ({playerStats.totalShips})</h4>
                <div className="text-xs text-gray-600">
                  Defenders: {playerStats.defenders} | Fighters: {playerStats.fighters}
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {playerShips.length > 0 ? (
                    playerShips.map((ship, index) => (
                      <div key={index} className="text-xs p-2 bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{ship.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {ship.shipId === 'defender' ? '❤️ Heals 1' : '⚔️ Deals 1'}
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500">No ships built yet</p>
                  )}
                </div>
              </div>
            )}

            {/* Ship Building - Only in Ship Building Phase */}
            {!isSpectator && currentPlayer?.faction && currentPhase === SimplePhase.SHIP_BUILDING && (
              <div className="space-y-2">
                <h4 className="text-sm">Build Ships</h4>
                <Select onValueChange={setSelectedShipToBuild} value={selectedShipToBuild}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose ship to build" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableShips.map((ship) => (
                      <SelectItem key={ship.id} value={ship.id}>
                        {ship.name} ({ship.lineCost} lines)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  onClick={handleBuildShip} 
                  size="sm" 
                  className="w-full"
                  disabled={!selectedShipToBuild}
                >
                  Build Ship
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Phase Actions Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Phase Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Opponent Info */}
            {opponent && (
              <div className="space-y-2">
                <h4 className="text-sm">Opponent: {opponent.name}</h4>
                <div className="text-xs text-gray-600">
                  Species: {opponent.faction || 'Not Selected'}<br/>
                  Health: {opponent.health || 25}<br/>
                  Ships: {opponentStats.totalShips} (D:{opponentStats.defenders} F:{opponentStats.fighters})
                </div>
              </div>
            )}

            <Separator />

            {/* Phase-Specific Actions */}
            <div className="space-y-3">
              {/* Only show phase info for gameplay phases, hide setup */}
              {currentPhase === SimplePhase.SETUP ? (
                <h4 className="text-sm">Game Setup - Species Selection</h4>
              ) : currentPhase === SimplePhase.END_OF_GAME ? (
                <h4 className="text-sm text-red-600">Game Over</h4>
              ) : (
                <h4 className="text-sm">Turn {turnNumber} • {currentPhase.replace('_', ' ').toUpperCase()}</h4>
              )}
              
              {!isSpectator && (() => {
                switch (currentPhase) {
                  case SimplePhase.SETUP:
                    return (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-600">
                          Select your species for the entire game. Once all players select, the game begins.
                        </p>
                        {!currentPlayer?.faction ? (
                          <div className="space-y-2">
                            <Select onValueChange={setSelectedSpecies} value={selectedSpecies}>
                              <SelectTrigger>
                                <SelectValue placeholder="Choose your species" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="human">Human</SelectItem>
                                <SelectItem value="xenite">Xenite</SelectItem>
                                <SelectItem value="centaur">Centaur</SelectItem>
                                <SelectItem value="ancient">Ancient</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button onClick={handleSelectSpecies} className="w-full">
                              Confirm Species: {selectedSpecies.toUpperCase()}
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="text-center">
                              <Badge variant="default" className="text-sm">
                                {currentPlayer.faction.toUpperCase()} Selected
                              </Badge>
                            </div>
                            <p className="text-xs text-center text-gray-600">
                              Waiting for all players to select their species...
                            </p>
                            <p className="text-xs text-center text-green-600 mt-2">
                              ✅ Game will begin automatically when all players are ready
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  
                  case SimplePhase.DICE_ROLL:
                    return (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-600">
                          Dice rolled automatically and shared between players.
                        </p>
                        {!diceRoll ? (
                          <div className="text-center py-4">
                            <div className="animate-pulse text-lg mb-2">🎲 Rolling dice...</div>
                            <p className="text-xs text-gray-500">
                              Waiting for shared dice result...
                            </p>
                          </div>
                        ) : (
                          <div className="text-center">
                            <div className="text-2xl mb-2">🎲 {diceRoll}</div>
                            <p className="text-xs text-gray-600 mb-2">
                              Both players got {diceRoll} lines to spend on ships!
                            </p>
                            <p className="text-xs text-green-600">
                              ✅ Automatically advancing to Ship Building...
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  
                  case SimplePhase.SHIP_BUILDING:
                    const allPlayersReady = activePlayers.length >= 2 && activePlayers.every(p => p.isReady);
                    const playersReadyCount = activePlayers.filter(p => p.isReady).length;
                    
                    return (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-600">
                          Spend lines to build ships. Use the ship building interface in Your Status panel.
                        </p>
                        
                        <div className="text-center py-2">
                          <div className="text-sm mb-2">
                            Players Ready: {playersReadyCount}/{activePlayers.length}
                          </div>
                          
                          {!allPlayersReady ? (
                            <div className="space-y-2">
                              <p className="text-xs text-orange-600">
                                ⏳ Waiting for both players to be ready...
                              </p>
                              <div className="text-xs text-gray-500">
                                {activePlayers.map(p => (
                                  <div key={p.id}>
                                    {p.name}: {p.isReady ? '✅ Ready' : '○ Not Ready'}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-green-600">
                              ✅ Both players ready! Automatically advancing to combat...
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  
                  case SimplePhase.AUTOMATIC_POWERS:
                    return (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-600">
                          Ships automatically applying their powers - damage and healing calculated.
                        </p>
                        <div className="text-center py-4">
                          <div className="animate-pulse text-lg mb-2">⚔️ Processing combat...</div>
                          <p className="text-xs text-gray-500">
                            Calculating ship powers and damage...
                          </p>
                          <p className="text-xs text-green-600 mt-2">
                            ✅ Will automatically advance to Health Resolution
                          </p>
                        </div>
                      </div>
                    );
                  
                  case SimplePhase.HEALTH_RESOLUTION:
                    return (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-600">
                          Applying damage and healing. Checking win conditions.
                        </p>
                        <div className="text-center py-4">
                          <div className="animate-pulse text-lg mb-2">❤️ Resolving health...</div>
                          <p className="text-xs text-gray-500">
                            Applying damage, checking victory conditions...
                          </p>
                          <p className="text-xs text-green-600 mt-2">
                            ✅ Will automatically advance to next turn or end game
                          </p>
                        </div>
                      </div>
                    );
                  
                  case SimplePhase.END_OF_GAME:
                    const winner = gameState?.winner;
                    return (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-center">
                          🎉 Game Over! 🎉
                        </p>
                        {winner ? (
                          <p className="text-center text-green-600">
                            Winner: {winner.name}
                          </p>
                        ) : (
                          <p className="text-center text-yellow-600">
                            Game ended in a draw!
                          </p>
                        )}
                        <Button 
                          onClick={() => {
                            setCurrentGameId('');
                            window.history.pushState({}, document.title, window.location.pathname);
                          }} 
                          className="w-full"
                        >
                          Start New Game
                        </Button>
                      </div>
                    );
                  
                  default:
                    return (
                      <p className="text-xs text-gray-600">
                        Processing phase...
                      </p>
                    );
                }
              })()}
              
              {isSpectator && (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-600">You are observing as a spectator.</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Active players: {activePlayers.map(p => p.name).join(', ')}
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Chat */}
            <div className="space-y-2">
              <h4 className="text-sm">Messages</h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1 px-2 py-1 border rounded text-sm"
                  placeholder="Type message..."
                />
                <Button onClick={handleSendMessage} size="sm">
                  Send
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Actions Log */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Game Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div 
            ref={gameLogRef}
            className="h-64 overflow-y-auto bg-gray-50 rounded-md p-4"
          >
            <div className="space-y-2">
              {gameState?.actions?.length > 0 ? (
                gameState.actions.map((action, index) => (
                  <div key={index} className="text-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-medium">{action.playerName}:</span> {action.content}
                      </div>
                      <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">
                        {new Date(action.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No game actions yet</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
