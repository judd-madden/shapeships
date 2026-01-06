/**
 * MULTIPLAYER PANEL
 * 
 * Alpha v3: Private Games Only
 * Displays game creation controls and delegates backend calls to parent
 */

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';

interface MultiplayerPanelProps {
  alphaDisableAuth: boolean;
  onGameCreated: (gameId: string) => void;
  onCreatePrivateGame: () => Promise<string>;
  onNavigateToCreateGame?: () => void;
}

export function MultiplayerPanel({ 
  alphaDisableAuth, 
  onGameCreated, 
  onCreatePrivateGame,
  onNavigateToCreateGame
}: MultiplayerPanelProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreatePrivateGame = async () => {
    setIsCreating(true);
    setError('');

    try {
      const gameId = await onCreatePrivateGame();
      onGameCreated(gameId);
    } catch (error: any) {
      setError(error.message || 'Failed to create game');
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