import React from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { DefenderShip, BattlecruiserShip, CarrierShip6, CarrierShip5, CarrierShip4, CarrierShip3, CarrierShip2, CarrierShip1, CarrierShip0, CommanderShip, DreadnoughtShip, EarthShip, FighterShip, FrigateShip, GuardianShip2, GuardianShip1, GuardianShip0, InterceptorShip1, InterceptorShip0, LeviathanShip, OrbitalShip, ScienceVesselShip, StarshipShip, TacticalCruiserShip } from '../graphics/human/assets';
import { AntlionShip1, AntlionShip0, AntlionArrayShip, AsteriteShip, AsteriteFaceShip, BugBreeder4Ship, BugBreeder3Ship, BugBreeder2Ship, BugBreeder1Ship, BugBreederDepletedShip, ChronoswarmShip, DefenseSwarmShip, EvolverShip, HellHornetShip, HiveShip, MantisShip, OxiteShip, OxiteFaceShip, QueenShip, SacrificialPoolShip, XeniteShip, ZenithShip } from '../graphics/xenite/assets';
import { ArkOfDestructionShip, ArkOfDominationShip, ArkOfEntropyShip, ArkOfFuryShip, ArkOfKnowledgeShip, ArkOfPowerShip, ArkOfRedemptionShip, ArkOfTerrorShip, ShipOfAngerShip, ShipOfEquality2Ship, ShipOfEquality1Ship, ShipOfEquality0Ship, ShipOfFamily3Ship, ShipOfFamily2Ship, ShipOfFamily1Ship, ShipOfFamily0Ship, ShipOfFearShip, ShipOfLegacyShip, ShipOfVigorShip, ShipOfWisdom2Ship, ShipOfWisdom1Ship, ShipOfWisdom0Ship } from '../graphics/centaur/assets';
import { MercuryCore, PlutoCore, QuantumMystic, SolarReserve4, SolarReserve3, SolarReserve2, SolarReserve1, SolarReserve0, Spiral, UranusCore } from '../graphics/ancient/assets';

// External URL for space background
const SPACE_BACKGROUND_URL = 'https://juddmadden.com/shapeships/images/space-background.jpg';

// Ship registry - will be populated as ships are added
const SHIP_REGISTRY = {
  human: {
    name: 'Human',
    ships: [
      { id: 'battlecruiser', name: 'Battlecruiser', component: BattlecruiserShip, hasCharges: false },
      { id: 'carrier6', name: 'Carrier 6', component: CarrierShip6, hasCharges: true },
      { id: 'carrier5', name: 'Carrier 5', component: CarrierShip5, hasCharges: true },
      { id: 'carrier4', name: 'Carrier 4', component: CarrierShip4, hasCharges: true },
      { id: 'carrier3', name: 'Carrier 3', component: CarrierShip3, hasCharges: true },
      { id: 'carrier2', name: 'Carrier 2', component: CarrierShip2, hasCharges: true },
      { id: 'carrier1', name: 'Carrier 1', component: CarrierShip1, hasCharges: true },
      { id: 'carrier0', name: 'Carrier 0', component: CarrierShip0, hasCharges: true },
      { id: 'commander', name: 'Commander', component: CommanderShip, hasCharges: false },
      { id: 'defender', name: 'Defender', component: DefenderShip, hasCharges: false },
      { id: 'dreadnought', name: 'Dreadnought', component: DreadnoughtShip, hasCharges: false },
      { id: 'earthship', name: 'Earth Ship', component: EarthShip, hasCharges: false },
      { id: 'fighter', name: 'Fighter', component: FighterShip, hasCharges: false },
      { id: 'frigate', name: 'Frigate', component: FrigateShip, hasCharges: false },
      { id: 'guardian2', name: 'Guardian 2', component: GuardianShip2, hasCharges: true },
      { id: 'guardian1', name: 'Guardian 1', component: GuardianShip1, hasCharges: true },
      { id: 'guardian0', name: 'Guardian 0', component: GuardianShip0, hasCharges: true },
      { id: 'interceptor1', name: 'Interceptor 1', component: InterceptorShip1, hasCharges: true },
      { id: 'interceptor0', name: 'Interceptor 0', component: InterceptorShip0, hasCharges: true },
      { id: 'leviathan', name: 'Leviathan', component: LeviathanShip, hasCharges: false },
      { id: 'orbital', name: 'Orbital', component: OrbitalShip, hasCharges: false },
      { id: 'sciencevessel', name: 'Science Vessel', component: ScienceVesselShip, hasCharges: false },
      { id: 'starship', name: 'Starship', component: StarshipShip, hasCharges: false },
      { id: 'tacticalcruiser', name: 'Tactical Cruiser', component: TacticalCruiserShip, hasCharges: false }
    ]
  },
  xenite: {
    name: 'Xenite',
    ships: [
      { id: 'antlion1', name: 'Antlion 1', component: AntlionShip1, hasCharges: true },
      { id: 'antlion0', name: 'Antlion 0', component: AntlionShip0, hasCharges: true },
      { id: 'antlionarray', name: 'Antlion Array', component: AntlionArrayShip, hasCharges: false },
      { id: 'asterite', name: 'Asterite', component: AsteriteShip, hasCharges: false },
      { id: 'asteriteface', name: 'Asterite Face', component: AsteriteFaceShip, hasCharges: false },
      { id: 'bugbreeder4', name: 'Bug Breeder 4', component: BugBreeder4Ship, hasCharges: true },
      { id: 'bugbreeder3', name: 'Bug Breeder 3', component: BugBreeder3Ship, hasCharges: true },
      { id: 'bugbreeder2', name: 'Bug Breeder 2', component: BugBreeder2Ship, hasCharges: true },
      { id: 'bugbreeder1', name: 'Bug Breeder 1', component: BugBreeder1Ship, hasCharges: true },
      { id: 'bugbreeder0', name: 'Bug Breeder 0', component: BugBreederDepletedShip, hasCharges: true },
      { id: 'chronoswarm', name: 'Chronoswarm', component: ChronoswarmShip, hasCharges: false },
      { id: 'defenseswarm', name: 'Defense Swarm', component: DefenseSwarmShip, hasCharges: false },
      { id: 'evolver', name: 'Evolver', component: EvolverShip, hasCharges: false },
      { id: 'hellhornet', name: 'Hell Hornet', component: HellHornetShip, hasCharges: false },
      { id: 'hive', name: 'Hive', component: HiveShip, hasCharges: false },
      { id: 'mantis', name: 'Mantis', component: MantisShip, hasCharges: false },
      { id: 'oxite', name: 'Oxite', component: OxiteShip, hasCharges: false },
      { id: 'oxiteface', name: 'Oxite Face', component: OxiteFaceShip, hasCharges: false },
      { id: 'queen', name: 'Queen', component: QueenShip, hasCharges: false },
      { id: 'sacrificialpool', name: 'Sacrificial Pool', component: SacrificialPoolShip, hasCharges: false },
      { id: 'xenite', name: 'Xenite', component: XeniteShip, hasCharges: false },
      { id: 'zenith', name: 'Zenith', component: ZenithShip, hasCharges: false }
    ]
  },
  centaur: {
    name: 'Centaur',
    ships: [
      { id: 'arkofdestruction', name: 'Ark of Destruction', component: ArkOfDestructionShip, hasCharges: false },
      { id: 'arkofdomination', name: 'Ark of Domination', component: ArkOfDominationShip, hasCharges: false },
      { id: 'arkofentropy', name: 'Ark of Entropy', component: ArkOfEntropyShip, hasCharges: false },
      { id: 'arkoffury', name: 'Ark of Fury', component: ArkOfFuryShip, hasCharges: false },
      { id: 'arkofknowledge', name: 'Ark of Knowledge', component: ArkOfKnowledgeShip, hasCharges: false },
      { id: 'arkofpower', name: 'Ark of Power', component: ArkOfPowerShip, hasCharges: false },
      { id: 'arkofredemption', name: 'Ark of Redemption', component: ArkOfRedemptionShip, hasCharges: false },
      { id: 'arkofterror', name: 'Ark of Terror', component: ArkOfTerrorShip, hasCharges: false },
      { id: 'shipofanger', name: 'Ship of Anger', component: ShipOfAngerShip, hasCharges: false },
      { id: 'shipofequality2', name: 'Ship of Equality 2', component: ShipOfEquality2Ship, hasCharges: true },
      { id: 'shipofequality1', name: 'Ship of Equality 1', component: ShipOfEquality1Ship, hasCharges: true },
      { id: 'shipofequality0', name: 'Ship of Equality 0', component: ShipOfEquality0Ship, hasCharges: true },
      { id: 'shipoffamily3', name: 'Ship of Family 3', component: ShipOfFamily3Ship, hasCharges: true },
      { id: 'shipoffamily2', name: 'Ship of Family 2', component: ShipOfFamily2Ship, hasCharges: true },
      { id: 'shipoffamily1', name: 'Ship of Family 1', component: ShipOfFamily1Ship, hasCharges: true },
      { id: 'shipoffamily0', name: 'Ship of Family 0', component: ShipOfFamily0Ship, hasCharges: true },
      { id: 'shipoffear', name: 'Ship of Fear', component: ShipOfFearShip, hasCharges: false },
      { id: 'shipoflegacy', name: 'Ship of Legacy', component: ShipOfLegacyShip, hasCharges: false },
      { id: 'shipofvigor', name: 'Ship of Vigor', component: ShipOfVigorShip, hasCharges: false },
      { id: 'shipofwisdom2', name: 'Ship of Wisdom 2', component: ShipOfWisdom2Ship, hasCharges: true },
      { id: 'shipofwisdom1', name: 'Ship of Wisdom 1', component: ShipOfWisdom1Ship, hasCharges: true },
      { id: 'shipofwisdom0', name: 'Ship of Wisdom 0', component: ShipOfWisdom0Ship, hasCharges: true }
    ]
  },
  ancient: {
    name: 'Ancient',
    ships: [
      { id: 'mercurycore', name: 'Mercury Core', component: MercuryCore, hasCharges: false },
      { id: 'plutocore', name: 'Pluto Core', component: PlutoCore, hasCharges: false },
      { id: 'quantummystic', name: 'Quantum Mystic', component: QuantumMystic, hasCharges: false },
      { id: 'solarreserve4', name: 'Solar Reserve 4', component: SolarReserve4, hasCharges: false },
      { id: 'solarreserve3', name: 'Solar Reserve 3', component: SolarReserve3, hasCharges: false },
      { id: 'solarreserve2', name: 'Solar Reserve 2', component: SolarReserve2, hasCharges: false },
      { id: 'solarreserve1', name: 'Solar Reserve 1', component: SolarReserve1, hasCharges: false },
      { id: 'solarreserve0', name: 'Solar Reserve 0', component: SolarReserve0, hasCharges: false },
      { id: 'spiral', name: 'Spiral', component: Spiral, hasCharges: false },
      { id: 'uranuscore', name: 'Uranus Core', component: UranusCore, hasCharges: false }
    ]
  }
};

export default function GraphicsTest({ onBack }) {
  return (
    <div className="container mx-auto p-6 max-w-6xl">
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

        {/* Ship Gallery by Species */}
        <Card>
          <CardHeader>
            <CardTitle>🚀 Ship Gallery - All Species</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {Object.entries(SHIP_REGISTRY).map(([speciesId, speciesData]) => (
                <div key={speciesId}>
                  <h3 className="mb-4 text-lg">{speciesData.name}</h3>
                  {speciesData.ships.length === 0 ? (
                    <p className="text-gray-500 text-sm italic">No ships added yet</p>
                  ) : (
                    <div 
                      className="grid gap-6 p-6 rounded-lg bg-cover bg-center bg-no-repeat"
                      style={{ 
                        backgroundImage: `url(${SPACE_BACKGROUND_URL})`,
                        backgroundColor: '#000033',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))'
                      }}
                    >
                      {speciesData.ships.map((ship) => {
                        const ShipComponent = ship.component;
                        return (
                          <div key={ship.id} className="flex flex-col items-center gap-2">
                            <ShipComponent />
                            <span className="text-white text-sm drop-shadow-lg">{ship.name}</span>
                            {ship.hasCharges && (
                              <span className="text-xs text-gray-300 drop-shadow-lg">(Multiple states)</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Detailed Example Section */}
        <Card>
          <CardHeader>
            <CardTitle>Ship Scaling & Opacity Examples</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Ship graphics test */}
              <div className="border rounded-lg p-4 bg-green-50">
                <h3 className="mb-2 text-green-900">🚀 Defender Ship Variations</h3>
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