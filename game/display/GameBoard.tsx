// Game board display component - pure UI component that renders game state
// This component is purely for display and user interaction, no game logic

import React, { useState } from 'react';
import { GameState, GameAction, DisplayState } from '../types/GameTypes';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import globalAssets from '../../graphics/global/assets';

interface GameBoardProps {
  gameState: GameState;
  isMyTurn: boolean;
  onAction: (action: Omit<GameAction, 'id' | 'timestamp'>) => void;
  validActions: GameAction[];
  playerId: string;
}

export default function GameBoard({ 
  gameState, 
  isMyTurn, 
  onAction, 
  validActions, 
  playerId 
}: GameBoardProps) {
  const [displayState, setDisplayState] = useState<DisplayState>({
    uiMode: 'normal'
  });

  const handleEndTurn = () => {
    onAction({
      playerId,
      type: 'end_turn',
      data: {}
    });
  };

  const handleSurrender = () => {
    if (window.confirm('Are you sure you want to surrender?')) {
      onAction({
        playerId,
        type: 'surrender',
        data: {}
      });
    }
  };

  const renderBoard = () => {
    // Placeholder board rendering - will be customized based on your game rules
    return (
      <div 
        className="w-full h-96 border-2 border-shapeships-grey-20 rounded-lg bg-cover bg-center relative"
        style={{ 
          backgroundImage: `url(${globalAssets.spaceBackground})`,
          backgroundColor: '#000033'
        }}
      >
        <div className="absolute inset-0 bg-black/20 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="text-shapeships-white text-lg mb-2">Game Board</div>
            <div className="text-shapeships-grey-20 text-sm">
              Board will be rendered here based on your game rules
            </div>
            <div className="text-shapeships-grey-20 text-xs mt-2">
              Current board state: {JSON.stringify(gameState.gameData.board).substring(0, 50)}...
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderGameInfo = () => {
    const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayerId);
    
    return (
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-shapeships-grey-70 mb-1">Current Turn</div>
            <div className="text-shapeships-grey-90">
              {currentPlayer?.name || 'Unknown Player'}
              {currentPlayer?.id === playerId && ' (You)'}
            </div>
            <div className="text-xs text-shapeships-grey-50 mt-1">
              Turn {gameState.currentTurn + 1}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-shapeships-grey-70 mb-1">Game Status</div>
            <div className="text-shapeships-grey-90 capitalize">
              {gameState.status}
            </div>
            <div className="text-xs text-shapeships-grey-50 mt-1">
              {gameState.players.length} players
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderActions = () => {
    if (!isMyTurn) {
      return (
        <div className="text-center p-4 bg-shapeships-grey-20 rounded-lg">
          <div className="text-shapeships-grey-70">Waiting for other player...</div>
        </div>
      );
    }

    return (
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-shapeships-grey-70 mb-3">Your Turn - Available Actions</div>
          <div className="flex gap-2 flex-wrap">
            {validActions.map((action, index) => (
              <Button
                key={index}
                variant={action.type === 'end_turn' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  if (action.type === 'end_turn') {
                    handleEndTurn();
                  } else {
                    onAction({
                      playerId,
                      type: action.type,
                      data: action.data
                    });
                  }
                }}
              >
                {action.type.replace('_', ' ').toUpperCase()}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSurrender}
              className="text-shapeships-red border-shapeships-red hover:bg-shapeships-red hover:text-white"
            >
              Surrender
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderPlayers = () => {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-shapeships-grey-70 mb-3">Players</div>
          <div className="space-y-2">
            {gameState.players.map((player) => (
              <div 
                key={player.id} 
                className={`flex items-center justify-between p-2 rounded ${
                  player.isActive ? 'bg-shapeships-pastel-blue/20' : 'bg-shapeships-grey-20/20'
                }`}
              >
                <div>
                  <div className="text-sm text-shapeships-grey-90">
                    {player.name}
                    {player.id === playerId && ' (You)'}
                  </div>
                  <div className="text-xs text-shapeships-grey-50 capitalize">
                    {player.faction}
                  </div>
                </div>
                {player.isActive && (
                  <div className="text-xs bg-shapeships-pastel-blue text-shapeships-grey-90 px-2 py-1 rounded">
                    Active
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main game board */}
      <div className="lg:col-span-2 space-y-4">
        {renderGameInfo()}
        {renderBoard()}
        {renderActions()}
      </div>

      {/* Side panel */}
      <div className="space-y-4">
        {renderPlayers()}
        
        {/* Game data debug (development only) */}
        <Card className="border-shapeships-grey-20">
          <CardContent className="p-4">
            <div className="text-sm text-shapeships-grey-70 mb-2">Debug: Game Data</div>
            <pre className="text-xs bg-shapeships-grey-20/20 p-2 rounded overflow-auto max-h-32">
              {JSON.stringify(gameState.gameData, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}