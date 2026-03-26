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

import type { ActionPanelViewModel, GameSessionActions } from '../../../../../client/useGameSession';
import { ActionPanelScrollArea } from '../../../primitives/ActionPanelScrollArea';
import { CatalogueShipSlot } from '../shared/CatalogueShipSlot';
import { CatalogueCostNumber } from '../shared/CatalogueCostNumber';
import { ShipHoverCard } from '../shared/ShipHoverCard';
import { useShipCatalogueHover } from '../shared/useShipCatalogueHover';
import { getShipEligibilityForHover } from '../shared/ShipBuildEligibility';
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

interface HumanShipCataloguePanelProps {
  actions: GameSessionActions;
  buildCatalogue: ActionPanelViewModel['buildCatalogue'];
}

export function HumanShipCataloguePanel({ actions, buildCatalogue }: HumanShipCataloguePanelProps) {
  const hover = useShipCatalogueHover();
  const isBuildableContext = buildCatalogue.context === 'buildable';

  function getSlotProps(shipId: ShipDefId) {
    const canAddShip = buildCatalogue.canAddShipById[shipId] === true;
    return {
      isDimmed: isBuildableContext && !canAddShip,
      isClickable: isBuildableContext && canAddShip,
      onClick: () => actions.onBuildShip(shipId),
    };
  }

  function getDisplayCost(shipId: ShipDefId, fallbackCost: number): number {
    return isBuildableContext
      ? (buildCatalogue.displayCostByShipId[shipId] ?? fallbackCost)
      : fallbackCost;
  }

  const hoveredShipEligibility = hover.state.activeShipId
    ? getShipEligibilityForHover({
        shipId: hover.state.activeShipId,
        buildCatalogue,
      })
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
                {...getSlotProps('DEF')}
              >
                <CatalogueCostNumber cost={getDisplayCost('DEF', 2)} className="min-w-full relative shrink-0 w-[min-content]" />
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
                {...getSlotProps('FIG')}
              >
                <CatalogueCostNumber cost={getDisplayCost('FIG', 3)} className="min-w-full relative shrink-0 w-[min-content]" />
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
                {...getSlotProps('COM')}
              >
                <CatalogueCostNumber cost={getDisplayCost('COM', 4)} className="min-w-full relative shrink-0 w-[min-content]" />
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
                {...getSlotProps('INT')}
              >
                <CatalogueCostNumber cost={getDisplayCost('INT', 4)} className="min-w-full relative shrink-0 w-[min-content]" />
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
                {...getSlotProps('ORB')}
              >
                <CatalogueCostNumber cost={getDisplayCost('ORB', 6)} className="min-w-full relative shrink-0 w-[min-content]" />
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
                  <div className="relative shrink-0" style={{ height: '90px', width: '93px' }}>
                    <CarrierShip6 />
                  </div>
                }
                {...getSlotProps('CAR')}
              >
                <CatalogueCostNumber cost={getDisplayCost('CAR', 6)} className="min-w-full relative shrink-0 w-[min-content]" />
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
                {...getSlotProps('STA')}
              >
                <CatalogueCostNumber cost={getDisplayCost('STA', 8)} className="min-w-full relative shrink-0 w-[min-content]" />
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
              {...getSlotProps('FRI')}
            >
              <CatalogueCostNumber cost={getDisplayCost('FRI', 8)} className="relative shrink-0 w-full" />
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
              {...getSlotProps('TAC')}
            >
              <CatalogueCostNumber cost={getDisplayCost('TAC', 10)} className="relative shrink-0 w-full" />
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
              {...getSlotProps('GUA')}
            >
              <CatalogueCostNumber cost={getDisplayCost('GUA', 12)} className="relative shrink-0 w-full" />
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
              {...getSlotProps('SCI')}
            >
              <CatalogueCostNumber cost={getDisplayCost('SCI', 17)} className="relative shrink-0 w-full" />
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
              {...getSlotProps('BAT')}
            >
              <CatalogueCostNumber cost={getDisplayCost('BAT', 20)} className="relative shrink-0 w-full" />
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
              {...getSlotProps('EAR')}
            >
              <CatalogueCostNumber cost={getDisplayCost('EAR', 23)} className="relative shrink-0 w-full" />
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
              {...getSlotProps('DRE')}
            >
              <CatalogueCostNumber cost={getDisplayCost('DRE', 27)} className="relative shrink-0 w-full" />
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
              {...getSlotProps('LEV')}
            >
              <CatalogueCostNumber cost={getDisplayCost('LEV', 44)} className="relative shrink-0" />
            </CatalogueShipSlot>
          </div>

        </div>
      </ActionPanelScrollArea>
      
      {/* PASS 2: Single hover card rendered via portal */}
      {hover.state.activeShipId && hover.state.anchorRect && hoveredShipEligibility && (
        <ShipHoverCard
          shipId={hover.state.activeShipId}
          anchorRect={hover.state.anchorRect}
          eligibility={hoveredShipEligibility}
        />
      )}
    </>
  );
}
