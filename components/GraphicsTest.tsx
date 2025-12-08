import React from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { DefenderShip } from '../graphics/human/assets';

// External URL for space background
const SPACE_BACKGROUND_URL = 'https://juddmadden.com/shapeships/images/space-background.jpg';

export default function GraphicsTest({ onBack }) {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <Button variant="outline" onClick={onBack} className="mb-4">
          Back to Dashboard
        </Button>
        <h1>Graphics Test</h1>
        <p className="text-gray-600">Testing embedded SVG ship graphics system</p>
      </div>

      <div className="space-y-6">
        <Card className="border-blue-300 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-900">🎨 Graphics System - Embedded SVG Components</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-blue-800">
                Ship graphics are embedded as React components within the app for instant loading and zero external dependencies.
              </p>
              <div className="p-3 bg-blue-100 rounded-md">
                <p className="text-blue-900 text-sm">
                  <strong>Architecture:</strong> SVG code embedded in TypeScript files → Bundled with app → Zero HTTP requests
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-md">
                <p className="text-blue-900 text-sm">
                  <strong>Benefits:</strong> ~40 KB total bundle size, instant rendering, works offline, version controlled with code
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Space Background Test</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">


              {/* Space background reference */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <h3 className="mb-2">🌌 Space Background</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Background image loaded from external URL (exception to embedded graphics rule)
                </p>
                <p className="text-xs text-gray-500">
                  Source: {SPACE_BACKGROUND_URL}
                </p>
              </div>

              {/* Ship graphics test */}
              <div className="border rounded-lg p-4 bg-green-50">
                <h3 className="mb-2 text-green-900">🚀 Ship Graphics Test</h3>
                <div className="space-y-4">
                  {/* Defender Ship */}
                  <div 
                    className="border rounded-lg p-6 bg-cover bg-center bg-no-repeat"
                    style={{ 
                      backgroundImage: `url(${SPACE_BACKGROUND_URL})`,
                      backgroundColor: '#000033'
                    }}
                  >
                    <h4 className="mb-4 text-white drop-shadow-lg">Human - Defender</h4>
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-white drop-shadow-lg w-24">Normal (52×32):</span>
                          <DefenderShip className="w-[52px] h-[32px]" />
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-white drop-shadow-lg w-24">2x (104×64):</span>
                          <DefenderShip className="w-[104px] h-[64px]" />
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-white drop-shadow-lg w-24">50% Opacity:</span>
                          <DefenderShip className="w-[52px] h-[32px] opacity-50" />
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-white drop-shadow-lg w-24">0.5x (26×16):</span>
                          <DefenderShip className="w-[26px] h-[16px]" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="text-gray-900 mb-2">✅ Implementation Architecture:</h4>
              <div className="text-sm text-gray-700 space-y-2">
                <p>
                  <strong>Approach:</strong> Individual SVGs embedded within app as React components
                </p>
                <p>
                  <strong>Location:</strong> Ship graphics stored in <code className="bg-gray-200 px-1 rounded">/graphics/{`{faction}`}/assets.tsx</code>
                </p>
                <p>
                  <strong>Styling:</strong> SVGs accept className prop for Tailwind utilities (opacity, scale, etc.)
                </p>
                <p>
                  <strong>Performance:</strong> Bundled with app (~40 KB for all ships), zero external requests, instant loading
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
