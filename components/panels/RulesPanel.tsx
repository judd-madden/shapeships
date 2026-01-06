/**
 * RULES PANEL
 * 
 * Alpha v3: Stub - To be implemented
 * Placeholder for game rules and species guides
 */

import React from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

export function RulesPanel() {
  return (
    <Card className="backdrop-blur-sm border-shapeships-grey-20/30" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}>
      <CardHeader>
        <CardTitle className="text-shapeships-grey-90">Rules & Codex</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-shapeships-grey-70 mb-4">
          Learn how to play Shapeships and master the tactics of each species.
        </p>
        <div className="space-y-2">
          <Button variant="outline" disabled className="w-full justify-start">
            Core Rules
          </Button>
          <Button variant="outline" disabled className="w-full justify-start">
            Human Species Guide
          </Button>
          <Button variant="outline" disabled className="w-full justify-start">
            Xenite Species Guide
          </Button>
          <Button variant="outline" disabled className="w-full justify-start">
            Centaur Species Guide
          </Button>
          <Button variant="outline" disabled className="w-full justify-start">
            Ancient Species Guide
          </Button>
          <Button variant="outline" disabled className="w-full justify-start">
            Turn Timing Reference
          </Button>
        </div>
        <p className="text-xs text-shapeships-grey-50 mt-4 italic">
          Full rules system implementation coming soon
        </p>
      </CardContent>
    </Card>
  );
}
