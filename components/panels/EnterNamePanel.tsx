/**
 * ENTER NAME PANEL
 * 
 * Alpha v3: Session-Only Entry
 * Simple name input for temporary session identity
 */

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { usePlayer } from '../../game/hooks/usePlayer';

interface EnterNamePanelProps {
  onSubmit: (displayName: string) => void;
}

export function EnterNamePanel({ onSubmit }: EnterNamePanelProps) {
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const { player } = usePlayer();

  const handleSubmit = (e: React.FormEvent) => {
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
