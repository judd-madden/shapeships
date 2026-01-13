/**
 * Human Ship Catalogue Panel
 * 
 * PASS 2 - Hover + Eligibility Implementation
 * - Portal-based hover cards with ship rules from JSON
 * - Build eligibility feedback (UI-only, no backend)
 * - Uses canonical ship IDs from ShipDefinitionsUI
 * - Hand-authored layout matching design exactly
 * 
 * NO backend calls, NO rules validation, NO engine imports in PASS 2
 */

import { ActionPanelScrollArea } from '../../../primitives/ActionPanelScrollArea';
import { CatalogueShipSlot } from '../shared/CatalogueShipSlot';
import { CatalogueCostNumber } from '../shared/CatalogueCostNumber';
import { ShipHoverCard } from '../shared/ShipHoverCard';
import { useShipCatalogueHover } from '../shared/useShipCatalogueHover';
import { computeShipEligibility } from '../shared/ShipBuildEligibility';
import { SHIP_DEFINITIONS_MAP } from '../../../../../data/ShipDefinitionsUI';
import type { ShipDefId } from '../../../../../types/ShipTypes.engine';
import {
  DefenderShip,
  FighterShip,
  CommanderShip,
  InterceptorShip1,
  OrbitalShip,
  CarrierShip6,
  StarshipShip,
  FrigateShip,
  TacticalCruiserShip,
  ScienceVesselShip,
  GuardianShip2,
  EarthShip,
  BattlecruiserShip,
  DreadnoughtShip,
  LeviathanShip,
} from '../../../../../../graphics/human/assets';

// PASS 2: Max ship limit stub (TODO: formalize limits in rules/engine)
const MAX_LIMIT_SHIPS: Partial<Record<ShipDefId, boolean>> = {
  ORB: true,  // Orbital
  SCI: true,  // Science Vessel
  // CHR will be added when Chronoswarm is implemented
};

export function HumanShipCataloguePanel() {
  // PASS 2: Hover state controller
  const hover = useShipCatalogueHover();
  
  // PASS 2 Stubs: Replace with VM data in PASS 3
  const isOpponentView = false; // TODO: Get from VM
  const ownedShipsById: Record<ShipDefId, number> = {}; // TODO: Get from VM
  const availableLines = 999; // TODO: Get from VM
  const availableJoiningLines = 999; // TODO: Get from VM
  
  // PASS 2: Hardcoded affordability for visual validation (will be replaced by eligibility)
  const canAfford = true;
  
  // Compute eligibility for hovered ship
  const hoveredShipEligibility = hover.state.activeShipId
    ? (() => {
        const ship = SHIP_DEFINITIONS_MAP[hover.state.activeShipId];
        return computeShipEligibility({
          shipId: hover.state.activeShipId,
          isOpponentView,
          ownedShipsById,
          totalLineCost: ship?.totalLineCost ?? 0,
          joiningLineCost: ship?.joiningLineCost ?? 0,
          availableLines,
          availableJoiningLines,
          maxLimitReachedById: MAX_LIMIT_SHIPS,
          componentShipIds: ship?.componentShips ?? []
        });
      })()
    : null;

  return (
    <>
      <ActionPanelScrollArea>
        {/* Container with exact width from Figma */}
        <div className="relative" style={{ width: '1210px', minHeight: '398px' }}>
          
          {/* Section Titles */}
          <p
            className="absolute font-['Roboto'] font-bold leading-[normal] text-[18px] text-white"
            style={{ left: '0', top: '0', fontVariationSettings: "'wdth' 100" }}
          >
            Human Basic Ships
          </p>
          
          <p
            className="absolute font-['Roboto'] font-bold leading-[normal] text-[18px] text-white"
            style={{ left: '427px', top: '0', fontVariationSettings: "'wdth' 100" }}
          >
            Human Upgraded Ships
          </p>

          {/* Vertical Divider */}
          <div
            className="absolute bg-[#555555]"
            style={{ left: '406px', top: '0', width: '1px', height: '398px' }}
          />

          {/* ================ BASIC SHIPS ================ */}
          
          {/* Basic Row 1 */}
          <div
            className="absolute content-stretch flex items-end justify-between"
            style={{ left: '0', top: '38px', width: '371px' }}
          >
            {/* Defender */}
            <div
              className="content-stretch flex flex-col items-center relative shrink-0"
              style={{ width: '52px' }}
              onMouseEnter={(e) => hover.onEnter('DEF', e.currentTarget)}
              onMouseLeave={() => hover.onLeave('DEF')}
            >
              <CatalogueShipSlot
                shipId="DEF"
                graphic={
                  <div className="relative shrink-0" style={{ height: '32px', width: '52px' }}>
                    <DefenderShip />
                  </div>
                }
                canAfford={canAfford}
              >
                <CatalogueCostNumber cost={2} className="min-w-full relative shrink-0 w-[min-content]" />
              </CatalogueShipSlot>
            </div>

            {/* Fighter */}
            <div
              className="content-stretch flex flex-col items-center relative shrink-0"
              style={{ width: '52px' }}
              onMouseEnter={(e) => hover.onEnter('FIG', e.currentTarget)}
              onMouseLeave={() => hover.onLeave('FIG')}
            >
              <CatalogueShipSlot
                shipId="FIG"
                graphic={
                  <div className="relative shrink-0" style={{ height: '45px', width: '52px' }}>
                    <FighterShip />
                  </div>
                }
                canAfford={canAfford}
              >
                <CatalogueCostNumber cost={3} className="min-w-full relative shrink-0 w-[min-content]" />
              </CatalogueShipSlot>
            </div>

            {/* Commander */}
            <div
              className="content-stretch flex flex-col items-center relative shrink-0"
              style={{ width: '48px' }}
              onMouseEnter={(e) => hover.onEnter('COM', e.currentTarget)}
              onMouseLeave={() => hover.onLeave('COM')}
            >
              <CatalogueShipSlot
                shipId="COM"
                graphic={
                  <div className="relative shrink-0" style={{ width: '48px', height: '48px' }}>
                    <CommanderShip />
                  </div>
                }
                canAfford={canAfford}
              >
                <CatalogueCostNumber cost={4} className="min-w-full relative shrink-0 w-[min-content]" />
              </CatalogueShipSlot>
            </div>

            {/* Interceptor */}
            <div
              className="content-stretch flex flex-col items-center relative shrink-0"
              style={{ width: '61px' }}
              onMouseEnter={(e) => hover.onEnter('INT', e.currentTarget)}
              onMouseLeave={() => hover.onLeave('INT')}
            >
              <CatalogueShipSlot
                shipId="INT"
                graphic={
                  <div className="relative shrink-0" style={{ height: '52px', width: '61px' }}>
                    <div style={{ position: 'absolute', inset: '-7.6% -9.71% -11.81% -9.71%' }}>
                      <InterceptorShip1 />
                    </div>
                  </div>
                }
                canAfford={canAfford}
              >
                <CatalogueCostNumber cost={4} className="min-w-full relative shrink-0 w-[min-content]" />
              </CatalogueShipSlot>
            </div>
          </div>

          {/* Basic Row 2 */}
          <div
            className="absolute content-stretch flex items-center justify-between"
            style={{ left: '3px', top: '127px', width: '368px' }}
          >
            {/* Orbital */}
            <div
              className="content-stretch flex flex-col items-center relative shrink-0"
              style={{ width: '79px' }}
              onMouseEnter={(e) => hover.onEnter('ORB', e.currentTarget)}
              onMouseLeave={() => hover.onLeave('ORB')}
            >
              <CatalogueShipSlot
                shipId="ORB"
                graphic={
                  <div className="relative shrink-0" style={{ height: '70px', width: '79px' }}>
                    <OrbitalShip />
                  </div>
                }
                canAfford={canAfford}
              >
                <CatalogueCostNumber cost={6} className="min-w-full relative shrink-0 w-[min-content]" />
              </CatalogueShipSlot>
            </div>

            {/* Carrier */}
            <div
              className="content-stretch flex flex-col items-center relative shrink-0"
              style={{ width: '93px' }}
              onMouseEnter={(e) => hover.onEnter('CAR', e.currentTarget)}
              onMouseLeave={() => hover.onLeave('CAR')}
            >
              <CatalogueShipSlot
                shipId="CAR"
                graphic={
                  <div className="relative shrink-0" style={{ height: '97px', width: '93px' }}>
                    <CarrierShip6 />
                  </div>
                }
                canAfford={canAfford}
              >
                <CatalogueCostNumber cost={6} className="min-w-full relative shrink-0 w-[min-content]" />
              </CatalogueShipSlot>
            </div>

            {/* Starship */}
            <div
              className="content-stretch flex flex-col items-center relative shrink-0"
              style={{ width: '102px' }}
              onMouseEnter={(e) => hover.onEnter('STA', e.currentTarget)}
              onMouseLeave={() => hover.onLeave('STA')}
            >
              <CatalogueShipSlot
                shipId="STA"
                graphic={
                  <div className="relative shrink-0" style={{ width: '102px', height: '102px' }}>
                    <StarshipShip />
                  </div>
                }
                canAfford={canAfford}
              >
                <CatalogueCostNumber cost={8} className="min-w-full relative shrink-0 w-[min-content]" />
              </CatalogueShipSlot>
            </div>
          </div>

          {/* ================ UPGRADED SHIPS ================ */}

          {/* Frigate */}
          <div
            className="absolute content-stretch flex flex-col items-center"
            style={{ left: '451px', top: '53px', width: '52px' }}
            onMouseEnter={(e) => hover.onEnter('FRI', e.currentTarget)}
            onMouseLeave={() => hover.onLeave('FRI')}
          >
            <CatalogueShipSlot
              shipId="FRI"
              graphic={
                <div className="relative shrink-0" style={{ height: '88px' }}>
                  <FrigateShip />
                </div>
              }
              canAfford={canAfford}
            >
              <CatalogueCostNumber cost={8} className="relative shrink-0 w-full" />
            </CatalogueShipSlot>
          </div>

          {/* Tactical Cruiser */}
          <div
            className="absolute content-stretch flex flex-col items-center"
            style={{ left: '530px', top: '31px', width: '129px' }}
            onMouseEnter={(e) => hover.onEnter('TAC', e.currentTarget)}
            onMouseLeave={() => hover.onLeave('TAC')}
          >
            <CatalogueShipSlot
              shipId="TAC"
              graphic={
                <div className="relative shrink-0" style={{ height: '112px' }}>
                  <TacticalCruiserShip />
                </div>
              }
              canAfford={canAfford}
            >
              <CatalogueCostNumber cost={10} className="relative shrink-0 w-full" />
            </CatalogueShipSlot>
          </div>

          {/* Guardian */}
          <div
            className="absolute content-stretch flex flex-col items-center"
            style={{ left: '448px', top: '181px', width: '180px' }}
            onMouseEnter={(e) => hover.onEnter('GUA', e.currentTarget)}
            onMouseLeave={() => hover.onLeave('GUA')}
          >
            <CatalogueShipSlot
              shipId="GUA"
              graphic={
                <div className="relative shrink-0" style={{ height: '48px' }}>
                  <GuardianShip2 />
                </div>
              }
              canAfford={canAfford}
            >
              <CatalogueCostNumber cost={12} className="relative shrink-0 w-full" />
            </CatalogueShipSlot>
          </div>

          {/* Science Vessel */}
          <div
            className="absolute content-stretch flex flex-col items-center"
            style={{ left: '642px', top: '116px', width: '138px' }}
            onMouseEnter={(e) => hover.onEnter('SCI', e.currentTarget)}
            onMouseLeave={() => hover.onLeave('SCI')}
          >
            <CatalogueShipSlot
              shipId="SCI"
              graphic={
                <div className="relative shrink-0" style={{ height: '113px' }}>
                  <ScienceVesselShip />
                </div>
              }
              canAfford={canAfford}
            >
              <CatalogueCostNumber cost={17} className="relative shrink-0 w-full" />
            </CatalogueShipSlot>
          </div>

          {/* Battlecruiser */}
          <div
            className="absolute content-stretch flex flex-col items-center"
            style={{ left: '689px', top: '0', width: '183px' }}
            onMouseEnter={(e) => hover.onEnter('BAT', e.currentTarget)}
            onMouseLeave={() => hover.onLeave('BAT')}
          >
            <CatalogueShipSlot
              shipId="BAT"
              graphic={
                <div className="relative shrink-0" style={{ height: '114px' }}>
                  <BattlecruiserShip />
                </div>
              }
              canAfford={canAfford}
            >
              <CatalogueCostNumber cost={20} className="relative shrink-0 w-full" />
            </CatalogueShipSlot>
          </div>

          {/* Earth Ship */}
          <div
            className="absolute content-stretch flex flex-col items-center"
            style={{ left: '813px', top: '32px', width: '211px' }}
            onMouseEnter={(e) => hover.onEnter('EAR', e.currentTarget)}
            onMouseLeave={() => hover.onLeave('EAR')}
          >
            <CatalogueShipSlot
              shipId="EAR"
              graphic={
                <div className="relative shrink-0" style={{ height: '166px' }}>
                  <EarthShip />
                </div>
              }
              canAfford={canAfford}
            >
              <CatalogueCostNumber cost={23} className="relative shrink-0 w-full" />
            </CatalogueShipSlot>
          </div>

          {/* Dreadnought */}
          <div
            className="absolute content-stretch flex flex-col items-center"
            style={{ left: '994px', top: '0', width: '198px' }}
            onMouseEnter={(e) => hover.onEnter('DRE', e.currentTarget)}
            onMouseLeave={() => hover.onLeave('DRE')}
          >
            <CatalogueShipSlot
              shipId="DRE"
              graphic={
                <div className="relative shrink-0" style={{ height: '105px' }}>
                  <DreadnoughtShip />
                </div>
              }
              canAfford={canAfford}
            >
              <CatalogueCostNumber cost={27} className="relative shrink-0 w-full" />
            </CatalogueShipSlot>
          </div>

          {/* Leviathan */}
          <div
            className="absolute content-stretch flex flex-col items-center"
            style={{ left: '955px', top: '143px' }}
            onMouseEnter={(e) => hover.onEnter('LEV', e.currentTarget)}
            onMouseLeave={() => hover.onLeave('LEV')}
          >
            <CatalogueShipSlot
              shipId="LEV"
              graphic={
                <div className="relative shrink-0" style={{ height: '222.123px', width: '239px' }}>
                  <LeviathanShip />
                </div>
              }
              canAfford={canAfford}
            >
              <CatalogueCostNumber cost={44} className="relative shrink-0" />
            </CatalogueShipSlot>
          </div>

        </div>
      </ActionPanelScrollArea>
      
      {/* PASS 2: Single hover card rendered via portal */}
      {hover.state.activeShipId && hover.state.anchorRect && hoveredShipEligibility && (
        <ShipHoverCard
          shipId={hover.state.activeShipId}
          anchorRect={hover.state.anchorRect}
          isOpponentView={isOpponentView}
          eligibility={hoveredShipEligibility}
        />
      )}
    </>
  );
}
