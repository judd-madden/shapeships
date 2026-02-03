/**
 * Xenite Ship Catalogue Panel
 * 
 * Cloned from HumanShipCataloguePanel.tsx
 * - Portal-based hover cards with ship rules from JSON
 * - Build eligibility feedback (UI-only, no backend)
 * - Uses canonical ship IDs from ShipDefinitionsUI
 * - Hand-authored layout matching Figma design exactly
 * 
 * NO backend calls, NO rules validation, NO engine imports
 */

import type { GameSessionActions } from '../../../../../client/useGameSession';
import { ActionPanelScrollArea } from '../../../primitives/ActionPanelScrollArea';
import { CatalogueShipSlot } from '../shared/CatalogueShipSlot';
import { CatalogueCostNumber } from '../shared/CatalogueCostNumber';
import { ShipHoverCard } from '../shared/ShipHoverCard';
import { useShipCatalogueHover } from '../shared/useShipCatalogueHover';
import { computeShipEligibility } from '../shared/ShipBuildEligibility';
import { SHIP_DEFINITIONS_MAP } from '../../../../../data/ShipDefinitionsUI';
import type { ShipDefId } from '../../../../../types/ShipTypes.engine';
import {
  XeniteShip,
  AntlionShip1,
  MantisShip,
  EvolverShip,
  HellHornetShip,
  BugBreeder4Ship,
  ZenithShip,
  DefenseSwarmShip,
  AntlionArrayShip,
  OxiteFaceShip,
  AsteriteFaceShip,
  SacrificialPoolShip,
  QueenShip,
  ChronoswarmShip,
  HiveShip,
} from '../../../../../../graphics/xenite/assets';

// PASS 2: Max ship limit stub (TODO: formalize limits in rules/engine)
const MAX_LIMIT_SHIPS: Partial<Record<ShipDefId, boolean>> = {
  CHR: true,  // Chronoswarm
};

interface XeniteShipCataloguePanelProps {
  actions: GameSessionActions;
}

export function XeniteShipCataloguePanel({ actions }: XeniteShipCataloguePanelProps) {
  // Hover state controller
  const hover = useShipCatalogueHover();
  
  // Stubs: Replace with VM data in future passes
  const isOpponentView = false; // TODO: Get from VM
  const ownedShipsById: Record<ShipDefId, number> = {}; // TODO: Get from VM
  const availableLines = 999; // TODO: Get from VM
  const availableJoiningLines = 999; // TODO: Get from VM
  
  // Hardcoded affordability for visual validation (will be replaced by eligibility)
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
            Xenite Basic Ships
          </p>
          
          <p
            className="absolute font-['Roboto'] font-bold leading-[normal] text-[18px] text-white"
            style={{ left: '427px', top: '0', fontVariationSettings: "'wdth' 100" }}
          >
            Xenite Upgraded Ships
          </p>

          {/* Vertical Divider */}
          <div
            className="absolute bg-[#555555]"
            style={{ left: '406px', top: '0', width: '1px', height: '398px' }}
          />

          {/* ================ BASIC SHIPS ================ */}
          
          {/* Basic Row 1: XEN, ANT, MAN, EVO */}
          <div
            className="absolute content-stretch flex items-end justify-between"
            style={{ left: '0', top: '61px', width: '378px' }}
          >
            {/* Xenite */}
            <div
              className="content-stretch flex flex-col items-center relative shrink-0"
              style={{ width: '36px' }}
              onMouseEnter={(e) => hover.onEnter('XEN', e.currentTarget)}
              onMouseLeave={() => hover.onLeave('XEN')}
            >
              <CatalogueShipSlot
                shipId="XEN"
                graphic={
                  <div className="relative shrink-0" style={{ height: '36px', width: '36px' }}>
                    <XeniteShip />
                  </div>
                }
                canAfford={canAfford}
                onClick={() => actions.onBuildShip('XEN')}
              >
                <CatalogueCostNumber cost={2} className="min-w-full relative shrink-0 w-[min-content]" />
              </CatalogueShipSlot>
            </div>

            {/* Antlion */}
            <div
              className="content-stretch flex flex-col items-center relative shrink-0"
              style={{ width: '44px' }}
              onMouseEnter={(e) => hover.onEnter('ANT', e.currentTarget)}
              onMouseLeave={() => hover.onLeave('ANT')}
            >
              <CatalogueShipSlot
                shipId="ANT"
                graphic={
                  <div className="relative shrink-0" style={{ height: '40px', width: '44px' }}>
                    <AntlionShip1 />
                  </div>
                }
                canAfford={canAfford}
                onClick={() => actions.onBuildShip('ANT')}
              >
                <CatalogueCostNumber cost={3} className="min-w-full relative shrink-0 w-[min-content]" />
              </CatalogueShipSlot>
            </div>

            {/* Mantis */}
            <div
              className="content-stretch flex flex-col items-center relative shrink-0"
              style={{ width: '40px' }}
              onMouseEnter={(e) => hover.onEnter('MAN', e.currentTarget)}
              onMouseLeave={() => hover.onLeave('MAN')}
            >
              <CatalogueShipSlot
                shipId="MAN"
                graphic={
                  <div className="relative shrink-0" style={{ width: '40px', height: '40px' }}>
                    <MantisShip />
                  </div>
                }
                canAfford={canAfford}
                onClick={() => actions.onBuildShip('MAN')}
              >
                <CatalogueCostNumber cost={4} className="min-w-full relative shrink-0 w-[min-content]" />
              </CatalogueShipSlot>
            </div>

            {/* Evolver */}
            <div
              className="content-stretch flex flex-col items-center relative shrink-0"
              style={{ width: '40px' }}
              onMouseEnter={(e) => hover.onEnter('EVO', e.currentTarget)}
              onMouseLeave={() => hover.onLeave('EVO')}
            >
              <CatalogueShipSlot
                shipId="EVO"
                graphic={
                  <div className="relative shrink-0" style={{ height: '40px', width: '40px' }}>
                    <EvolverShip />
                  </div>
                }
                canAfford={canAfford}
                onClick={() => actions.onBuildShip('EVO')}
              >
                <CatalogueCostNumber cost={4} className="min-w-full relative shrink-0 w-[min-content]" />
              </CatalogueShipSlot>
            </div>
          </div>

          {/* Basic Row 2: HEL, BUG, ZEN */}
          <div
            className="absolute content-stretch flex items-end justify-between"
            style={{ left: '6px', top: '175px', width: '372px' }}
          >
            {/* Hell Hornet */}
            <div
              className="content-stretch flex flex-col items-center relative shrink-0"
              style={{ width: '90px' }}
              onMouseEnter={(e) => hover.onEnter('HEL', e.currentTarget)}
              onMouseLeave={() => hover.onLeave('HEL')}
            >
              <CatalogueShipSlot
                shipId="HEL"
                graphic={
                  <div className="relative shrink-0" style={{ height: '40px', width: '90px' }}>
                    <HellHornetShip />
                  </div>
                }
                canAfford={canAfford}
                onClick={() => actions.onBuildShip('HEL')}
              >
                <CatalogueCostNumber cost={6} className="min-w-full relative shrink-0 w-[min-content]" />
              </CatalogueShipSlot>
            </div>

            {/* Bug Breeder */}
            <div
              className="content-stretch flex flex-col items-center relative shrink-0"
              style={{ width: '90px' }}
              onMouseEnter={(e) => hover.onEnter('BUG', e.currentTarget)}
              onMouseLeave={() => hover.onLeave('BUG')}
            >
              <CatalogueShipSlot
                shipId="BUG"
                graphic={
                  <div className="relative shrink-0" style={{ height: '40px', width: '90px' }}>
                    <BugBreeder4Ship />
                  </div>
                }
                canAfford={canAfford}
                onClick={() => actions.onBuildShip('BUG')}
              >
                <CatalogueCostNumber cost={6} className="min-w-full relative shrink-0 w-[min-content]" />
              </CatalogueShipSlot>
            </div>

            {/* Zenith */}
            <div
              className="content-stretch flex flex-col items-center relative shrink-0"
              style={{ width: '132px' }}
              onMouseEnter={(e) => hover.onEnter('ZEN', e.currentTarget)}
              onMouseLeave={() => hover.onLeave('ZEN')}
            >
              <CatalogueShipSlot
                shipId="ZEN"
                graphic={
                  <div className="relative shrink-0" style={{ width: '132px', height: '40px' }}>
                    <ZenithShip />
                  </div>
                }
                canAfford={canAfford}
                onClick={() => actions.onBuildShip('ZEN')}
              >
                <CatalogueCostNumber cost={9} className="min-w-full relative shrink-0 w-[min-content]" />
              </CatalogueShipSlot>
            </div>
          </div>

          {/* ================ UPGRADED SHIPS ================ */}

          {/* Defense Swarm */}
          <div
            className="absolute content-stretch flex flex-col items-center"
            style={{ left: '431px', top: '45px', width: '130px' }}
            onMouseEnter={(e) => hover.onEnter('DSW', e.currentTarget)}
            onMouseLeave={() => hover.onLeave('DSW')}
          >
            <CatalogueShipSlot
              shipId="DSW"
              graphic={
                <div className="relative shrink-0" style={{ height: '110px', width: '130px' }}>
                  <DefenseSwarmShip />
                </div>
              }
              canAfford={canAfford}
              onClick={() => actions.onBuildShip('DSW')}
            >
              <CatalogueCostNumber cost={9} className="relative shrink-0 w-full" />
            </CatalogueShipSlot>
          </div>

          {/* Antlion Array */}
          <div
            className="absolute content-stretch flex flex-col items-center"
            style={{ left: '510px', top: '106px', width: '130px' }}
            onMouseEnter={(e) => hover.onEnter('AAR', e.currentTarget)}
            onMouseLeave={() => hover.onLeave('AAR')}
          >
            <CatalogueShipSlot
              shipId="AAR"
              graphic={
                <div className="relative shrink-0" style={{ height: '110px', width: '130px' }}>
                  <AntlionArrayShip />
                </div>
              }
              canAfford={canAfford}
              onClick={() => actions.onBuildShip('AAR')}
            >
              <CatalogueCostNumber cost={12} className="relative shrink-0 w-full" />
            </CatalogueShipSlot>
          </div>

          {/* Sacrificial Pool */}
          <div
            className="absolute content-stretch flex flex-col items-center"
            style={{ left: '625px', top: '44px', width: '106px' }}
            onMouseEnter={(e) => hover.onEnter('SAC', e.currentTarget)}
            onMouseLeave={() => hover.onLeave('SAC')}
          >
            <CatalogueShipSlot
              shipId="SAC"
              graphic={
                <div className="relative shrink-0" style={{ height: '106px', width: '110px' }}>
                  <SacrificialPoolShip />
                </div>
              }
              canAfford={canAfford}
              onClick={() => actions.onBuildShip('SAC')}
            >
              <CatalogueCostNumber cost={12} className="relative shrink-0 w-full" />
            </CatalogueShipSlot>
          </div>

          {/* Asterite Face */}
          <div
            className="absolute content-stretch flex flex-col items-center"
            style={{ left: '754px', top: '143px', width: '110px' }}
            onMouseEnter={(e) => hover.onEnter('ASF', e.currentTarget)}
            onMouseLeave={() => hover.onLeave('ASF')}
          >
            <CatalogueShipSlot
              shipId="ASF"
              graphic={
                <div className="relative shrink-0" style={{ height: '106px', width: '110px' }}>
                  <AsteriteFaceShip />
                </div>
              }
              canAfford={canAfford}
              onClick={() => actions.onBuildShip('ASF')}
            >
              <CatalogueCostNumber cost={12} className="relative shrink-0 w-full" />
            </CatalogueShipSlot>
          </div>

          {/* Oxite Face */}
          <div
            className="absolute content-stretch flex flex-col items-center"
            style={{ left: '754px', top: '0', width: '110px' }}
            onMouseEnter={(e) => hover.onEnter('OXF', e.currentTarget)}
            onMouseLeave={() => hover.onLeave('OXF')}
          >
            <CatalogueShipSlot
              shipId="OXF"
              graphic={
                <div className="relative shrink-0" style={{ height: '106px', width: '110px' }}>
                  <OxiteFaceShip />
                </div>
              }
              canAfford={canAfford}
              onClick={() => actions.onBuildShip('OXF')}
            >
              <CatalogueCostNumber cost={12} className="relative shrink-0 w-full" />
            </CatalogueShipSlot>
          </div>

          {/* Queen */}
          <div
            className="absolute content-stretch flex flex-col items-center"
            style={{ left: '880px', top: '74px', width: '150px' }}
            onMouseEnter={(e) => hover.onEnter('QUE', e.currentTarget)}
            onMouseLeave={() => hover.onLeave('QUE')}
          >
            <CatalogueShipSlot
              shipId="QUE"
              graphic={
                <div className="relative shrink-0" style={{ height: '128px', width: '150px' }}>
                  <QueenShip />
                </div>
              }
              canAfford={canAfford}
              onClick={() => actions.onBuildShip('QUE')}
            >
              <CatalogueCostNumber cost={20} className="relative shrink-0 w-full" />
            </CatalogueShipSlot>
          </div>

          {/* Chronoswarm */}
          <div
            className="absolute content-stretch flex flex-col items-center"
            style={{ left: '1049px', top: '0', width: '150px' }}
            onMouseEnter={(e) => hover.onEnter('CHR', e.currentTarget)}
            onMouseLeave={() => hover.onLeave('CHR')}
          >
            <CatalogueShipSlot
              shipId="CHR"
              graphic={
                <div className="relative shrink-0" style={{ height: '140px', width: '150px' }}>
                  <ChronoswarmShip />
                </div>
              }
              canAfford={canAfford}
              onClick={() => actions.onBuildShip('CHR')}
            >
              <CatalogueCostNumber cost={25} className="relative shrink-0" />
            </CatalogueShipSlot>
          </div>

          {/* Hive */}
          <div
            className="absolute content-stretch flex flex-col items-center"
            style={{ left: '969px', top: '166px', width: '255px' }}
            onMouseEnter={(e) => hover.onEnter('HVE', e.currentTarget)}
            onMouseLeave={() => hover.onLeave('HVE')}
          >
            <CatalogueShipSlot
              shipId="HVE"
              graphic={
                <div className="relative shrink-0" style={{ height: '255px', width: '255px' }}>
                  <HiveShip />
                </div>
              }
              canAfford={canAfford}
              onClick={() => actions.onBuildShip('HVE')}
            >
              <CatalogueCostNumber cost={35} className="relative shrink-0" />
            </CatalogueShipSlot>
          </div>

        </div>
      </ActionPanelScrollArea>
      
      {/* Single hover card rendered via portal */}
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
