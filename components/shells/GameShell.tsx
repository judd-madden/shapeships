import React from 'react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

// ============================================================================
// GAME SHELL
// ============================================================================
// Canonical Shell for in-game experience
// Owns layout with game canvas and control panel
// ============================================================================

interface GameShellProps {
  onExit: () => void;
  gameId: string | null;
}

export function GameShell({ onExit, gameId }: GameShellProps) {
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-white drop-shadow-lg">Shapeships</h1>
        <p className="text-white/90 drop-shadow-md">Game ID: {gameId || 'Unknown'}</p>
      </div>

      {/* Main Layout: Game Canvas + Control Panel */}
      <div className="flex gap-6">
        {/* Game Canvas - Placeholder for now */}
        <div className="flex-1">
          <Card className="backdrop-blur-sm border-shapeships-grey-20/30" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}>
            <CardContent className="p-4">
              <div className="w-full h-96 bg-shapeships-grey-20/10 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-shapeships-grey-90 mb-2">Game Canvas Placeholder</p>
                  <p className="text-sm text-shapeships-grey-70">
                    Full game UI integration coming soon
                  </p>
                  <p className="text-xs text-shapeships-grey-50 mt-4">
                    Game ID: {gameId}
                  </p>
                </div>
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
