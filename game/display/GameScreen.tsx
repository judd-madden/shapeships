// Main game screen component - orchestrates the game display
// This is the top-level game component that uses the game engine

import React from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import GameBoard from './GameBoard';
import { useGameState } from '../hooks/useGameState';
import globalAssets from '../../graphics/global/assets';

interface GameScreenProps {
  gameId: string;
  playerId: string;
  playerName: string;
  onBack: () => void;
}

export default function GameScreen({ gameId, playerId, playerName, onBack }: GameScreenProps) {
  const {
    gameState,
    loading,
    error,
    sendAction,
    getValidActions,
    isMyTurn,
    getCurrentPlayer,
    refreshGameState
  } = useGameState(gameId, playerId);

  if (loading && !gameState) {
    return (
      <div 
        className="min-h-screen bg-cover bg-center flex items-center justify-center"
        style={{
          backgroundImage: `url(${globalAssets.spaceBackground})`,
          backgroundColor: '#000033'
        }}
      >
        <Card className="bg-black/50 backdrop-blur-sm border-shapeships-grey-20">
          <CardContent className="p-8 text-center">
            <div className="text-shapeships-white text-lg mb-2">Loading Game...</div>
            <div className="text-shapeships-grey-20 text-sm">Connecting to game {gameId}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className="min-h-screen bg-cover bg-center flex items-center justify-center"
        style={{
          backgroundImage: `url(${globalAssets.spaceBackground})`,
          backgroundColor: '#000033'
        }}
      >
        <Card className="bg-black/50 backdrop-blur-sm border-shapeships-red max-w-md">
          <CardHeader>
            <CardTitle className="text-shapeships-red">Game Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-shapeships-white">{error}</div>
            <div className="flex gap-2">
              <Button onClick={refreshGameState} variant="outline" className="flex-1">
                Retry
              </Button>
              <Button onClick={onBack} className="flex-1">
                Back to Menu
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!gameState) {
    return null;
  }

  const validActions = getValidActions();
  const currentPlayer = getCurrentPlayer();

  return (
    <div 
      className="min-h-screen bg-cover bg-center"
      style={{
        backgroundImage: `url(${globalAssets.spaceBackground})`,
        backgroundColor: '#000033'
      }}
    >
      {/* Header */}
      <div className="bg-black/50 backdrop-blur-sm border-b border-shapeships-grey-20">
        <div className="container mx-auto p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={onBack} size="sm">
              ← Back
            </Button>
            <div>
              <h1 className="text-shapeships-white text-xl">Shapeships</h1>
              <div className="text-shapeships-grey-20 text-sm">Game: {gameId}</div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Badge 
              variant={gameState.status === 'active' ? 'default' : 'secondary'}
              className={
                gameState.status === 'active' 
                  ? 'bg-shapeships-pastel-green text-shapeships-grey-90' 
                  : ''
              }
            >
              {gameState.status.toUpperCase()}
            </Badge>
            
            {currentPlayer && (
              <div className="text-right">
                <div className="text-shapeships-white text-sm">{currentPlayer.name}</div>
                <div className="text-shapeships-grey-20 text-xs capitalize">
                  {currentPlayer.faction}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Game Content */}
      <div className="container mx-auto p-6">
        {gameState.status === 'waiting' ? (
          <Card className="bg-black/50 backdrop-blur-sm border-shapeships-grey-20 max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-shapeships-white">Waiting for Players</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-shapeships-grey-20">
                {gameState.players.length} / {gameState.settings.maxPlayers} players joined
              </div>
              
              <div className="space-y-2">
                {gameState.players.map((player) => (
                  <div 
                    key={player.id} 
                    className="flex items-center justify-between p-3 bg-shapeships-grey-20/10 rounded"
                  >
                    <span className="text-shapeships-white">{player.name}</span>
                    <Badge variant="secondary" className="capitalize">
                      {player.faction}
                    </Badge>
                  </div>
                ))}
              </div>

              {gameState.players.length < gameState.settings.maxPlayers && (
                <div className="text-center">
                  <div className="text-shapeships-grey-20 text-sm mb-2">
                    Share this game URL with other players:
                  </div>
                  <div className="text-xs bg-shapeships-grey-20/10 p-2 rounded font-mono text-shapeships-white">
                    {window.location.href}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : gameState.status === 'completed' ? (
          <Card className="bg-black/50 backdrop-blur-sm border-shapeships-grey-20 max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-shapeships-white">Game Completed</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="text-shapeships-pastel-green text-lg">
                Game Over!
              </div>
              <Button onClick={onBack}>Return to Menu</Button>
            </CardContent>
          </Card>
        ) : (
          <GameBoard 
            gameState={gameState}
            isMyTurn={isMyTurn()}
            onAction={sendAction}
            validActions={validActions}
            playerId={playerId}
          />
        )}
      </div>
    </div>
  );
}