/**
 * Ancient Ship Catalogue Panel
 *
 * LEFT SIDE: Ancient Basic Ships (clickable, full wiring)
 * RIGHT SIDE: Ancient Solar Powers (reference display and declaration controls)
 *
 * Pattern cloned from CentaurShipCataloguePanel.tsx
 * NO backend calls, NO rules validation, NO engine imports
 */

import { useCallback, useEffect, useState, type ComponentType, type CSSProperties } from 'react';
import type { ActionPanelViewModel, GameSessionActions } from "../../../../../client/useGameSession";
import type { SpeciesId } from '../../../../../../components/ui/primitives/buttons/SpeciesCardButton';
import { Checkbox, InfoIcon } from '../../../../../../components/ui/primitives';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../../../../components/ui/tooltip';
import { ActionPanelScrollArea } from "../../../primitives/ActionPanelScrollArea";
import { CatalogueShipSlot } from "../shared/CatalogueShipSlot";
import { CatalogueCostNumber } from "../shared/CatalogueCostNumber";
import { ShipHoverCard } from "../shared/ShipHoverCard";
import { useShipCatalogueHover } from "../shared/useShipCatalogueHover";
import {
  getShipEligibilityForHover,
  shouldEnableCatalogueGraphicHover,
  type ShipEligibility,
} from "../shared/ShipBuildEligibility";
import type { ShipDefId } from "../../../../../types/ShipTypes.engine";
import {
  Asteroid,
  BlackHole,
  Convert,
  Life,
  MercuryCore,
  PlutoCore,
  QuantumMystic,
  Spiral,
  NeptuneCore,
  SolarReserve4,
  Cube,
  SimulacrumAncient,
  SimulacrumCentaur,
  SimulacrumHuman,
  SimulacrumXenite,
  Siphon,
  StarBirth,
  Supernova,
  Vortex,
} from "../../../../../../graphics/ancient/assets";
import {
  AncientEnergyDisplay,
  type AncientEnergyCostRow,
  type AncientEnergySpendPreview,
} from './AncientEnergyDisplay';
import { AncientSolarPowerSlot } from './AncientSolarPowerSlot';
import { AncientBlackHoleSelector } from './AncientBlackHoleSelector';
import { AncientSimulacrumSelector } from './AncientSimulacrumSelector';
import { AncientSiphonSelector } from './AncientSiphonSelector';
import {
  isFixedAncientManualSolarPowerId,
  type AncientEnergyPool,
  type AncientSolarSelectorMode,
  type FixedAncientManualSolarPowerId,
} from '../../../../../client/gameSession/ancientChargeDeclaration';
import { ANCIENT_SIPHON_MINIMUM_SPEND } from '../../../../../data/ancientSiphonRules';

type CatalogueFrame = 'desktop' | 'bare';
type CatalogueLayout = 'standard' | 'long';

export const ANCIENT_CATALOGUE_CANVAS_BY_LAYOUT = {
  standard: { width: 1210, height: 258 },
  long: { width: 1446, height: 258 },
} as const;

export const ANCIENT_CATALOGUE_SECTION_X = {
  basics: 0,
  solar: 427,
} as const;

export const ANCIENT_ENERGY_HEADER_POSITION_BY_LAYOUT = {
  standard: { x: 635, y: 0 },
  long: { x: 682, y: 0 },
} as const;

const ZERO_ANCIENT_ENERGY_POOL: AncientEnergyPool = { green: 0, red: 0, blue: 0 };
const REFERENCE_ANCIENT_CATALOGUE_ENERGY: NonNullable<
  ActionPanelViewModel['ancientCatalogueEnergy']
> = {
  mode: 'reference',
  pool: ZERO_ANCIENT_ENERGY_POOL,
  capacity: ZERO_ANCIENT_ENERGY_POOL,
};

interface SolarPosition {
  x: number;
  y: number;
}

interface SolarPowerSlotConfig {
  id: ShipDefId;
  graphic: ComponentType<{ className?: string }>;
  costRows: readonly AncientEnergyCostRow[];
  costPlacement?: 'right' | 'below';
  showPlus?: boolean;
  position: Record<CatalogueLayout, SolarPosition>;
}

const SOLAR_POWER_SLOTS = [
  {
    id: 'SLIF',
    graphic: Life,
    costRows: [{ color: 'green', count: 1 }],
    position: { standard: { x: 474, y: 69 }, long: { x: 507, y: 69 } },
  },
  {
    id: 'SSTA',
    graphic: StarBirth,
    costRows: [{ color: 'green', count: 3 }],
    position: { standard: { x: 443, y: 166 }, long: { x: 476, y: 166 } },
  },
  {
    id: 'SAST',
    graphic: Asteroid,
    costRows: [{ color: 'red', count: 1 }],
    position: { standard: { x: 640, y: 64 }, long: { x: 703, y: 64 } },
  },
  {
    id: 'SSUP',
    graphic: Supernova,
    costRows: [{ color: 'red', count: 3 }],
    position: { standard: { x: 609, y: 162 }, long: { x: 672, y: 162 } },
  },
  {
    id: 'SCON',
    graphic: Convert,
    costRows: [{ color: 'cyan', count: 1 }],
    position: { standard: { x: 803, y: 64 }, long: { x: 896, y: 64 } },
  },
  {
    id: 'SSIP',
    graphic: Siphon,
    costRows: [
      { color: 'green', count: ANCIENT_SIPHON_MINIMUM_SPEND },
      { color: 'red', count: ANCIENT_SIPHON_MINIMUM_SPEND },
    ],
    showPlus: true,
    position: { standard: { x: 919, y: 52 }, long: { x: 1047, y: 52 } },
  },
  {
    id: 'SSIM',
    graphic: SimulacrumHuman,
    costRows: [{ color: 'cyan', count: 2 }],
    showPlus: true,
    position: { standard: { x: 777, y: 165 }, long: { x: 870, y: 165 } },
  },
  {
    id: 'SVOR',
    graphic: Vortex,
    costRows: [
      { color: 'green', count: 2 },
      { color: 'red', count: 2 },
      { color: 'cyan', count: 2 },
    ],
    position: { standard: { x: 936, y: 164 }, long: { x: 1064, y: 164 } },
  },
  {
    id: 'SBLA',
    graphic: BlackHole,
    costRows: [
      { color: 'green', count: 4 },
      { color: 'red', count: 4 },
      { color: 'cyan', count: 4 },
    ],
    costPlacement: 'below',
    position: { standard: { x: 1098, y: 62 }, long: { x: 1263, y: 62 } },
  },
] as const satisfies readonly SolarPowerSlotConfig[];

const SOLAR_POWER_IDS = new Set<ShipDefId>(SOLAR_POWER_SLOTS.map((slot) => slot.id));

function buildEnergySpendPreview(
  costRows: readonly AncientEnergyCostRow[]
): AncientEnergySpendPreview {
  return costRows.reduce<AncientEnergySpendPreview>(
    (preview, row) => {
      const color = row.color === 'cyan' ? 'blue' : row.color;
      preview[color] += row.count;
      return preview;
    },
    { green: 0, red: 0, blue: 0 }
  );
}

const MANUAL_SOLAR_POWER_LABEL_BY_ID: Record<FixedAncientManualSolarPowerId, string> = {
  SLIF: 'Life',
  SSTA: 'Star Birth',
  SAST: 'Asteroid',
  SSUP: 'Supernova',
  SCON: 'Convert',
  SVOR: 'Vortex',
};
const AUTOCAST_TOOLTIP_PATHS = [
  {
    color: 'var(--shapeships-green)',
    powerNames: ['Star Birth', 'Life'],
  },
  {
    color: 'var(--shapeships-red)',
    powerNames: ['Supernova', 'Asteroid'],
  },
  {
    color: 'var(--shapeships-cyan)',
    powerNames: ['Convert'],
  },
] as const;

const SOLAR_HEADER_POSITIONS: Record<
  CatalogueLayout,
  SolarPosition
> = {
  standard: { x: 1079, y: 0 },
  long: { x: 1245, y: 0 },
};

const BLACK_HOLE_SELECTOR_LAYOUT: Record<
  CatalogueLayout,
  { x: number; y: number; gap: number }
> = {
  standard: { x: 436, y: 70, gap: 30 },
  long: { x: 484, y: 70, gap: 40 },
};

const SIPHON_SELECTOR_X: Record<CatalogueLayout, number> = {
  standard: 436,
  long: 450,
};

const SIMULACRUM_GRAPHICS: Record<SpeciesId, ComponentType<{ className?: string }>> = {
  human: SimulacrumHuman,
  xenite: SimulacrumXenite,
  centaur: SimulacrumCentaur,
  ancient: SimulacrumAncient,
};

interface AncientShipCataloguePanelProps {
  actions: GameSessionActions;
  buildCatalogue: ActionPanelViewModel['buildCatalogue'];
  frame?: CatalogueFrame;
  catalogueLayout?: CatalogueLayout;
  hoverDisabled?: boolean;
  interactionDisabled?: boolean;
  onShipInspect?: (shipId: ShipDefId) => void;
  simulacrumSpecies?: SpeciesId;
  presentation?: 'reference' | 'declaration';
  catalogueEnergy?: ActionPanelViewModel['ancientCatalogueEnergy'];
  declarationEnergy?: AncientEnergyPool;
  declarationEnergyCapacity?: AncientEnergyPool;
  declarationStage?: 'charges' | 'powers';
  canCastManualSolarPowerById?: Partial<Record<FixedAncientManualSolarPowerId, boolean>>;
  solarHoverValuesById?: NonNullable<
    ActionPanelViewModel['ancientChargeDeclaration']
  >['solarHoverValuesById'];
  selectorMode?: AncientSolarSelectorMode | null;
  siphonSelector?: {
    maxSpend: number;
    canOpen: boolean;
  };
  simulacrumSelector?: {
    canOpen: boolean;
    blueAvailable: number;
    hoveredPreviewBlueCost: number | null;
  };
  blackHoleSelector?: {
    canOpen: boolean;
    requiredTargetCount: number;
    selectedTargetCount: number;
    damagePreview: number;
  };
  autocastEnabled: boolean;
  autocastDisabled?: boolean;
  declarationAttemptUnresolved?: boolean;
  declarationBlocked?: boolean;
}

interface AncientAutocastControlProps {
  checked: boolean;
  disabled?: boolean;
  onChange: (enabled: boolean) => void;
  className?: string;
  style?: CSSProperties;
}

export function AncientAutocastControl({
  checked,
  disabled = false,
  onChange,
  className = '',
  style,
}: AncientAutocastControlProps) {
  const infoButton = (
    <button
      type="button"
      aria-label="About Autocast"
      disabled={disabled}
      className={disabled
        ? 'flex size-[24px] shrink-0 cursor-default items-center justify-center'
        : 'flex size-[24px] shrink-0 items-center justify-center opacity-50 transition-opacity duration-100 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white'}
    >
      <InfoIcon className="size-[24px]" />
    </button>
  );

  return (
    <div
      className={`flex items-center gap-[2px] ${disabled ? 'opacity-40' : ''} ${className}`}
      style={style}
    >
      <Checkbox
        className="!size-[24px]"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <span
        className="font-['Roboto'] text-[18px] font-bold leading-none text-white"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        Autocast
      </span>
      {disabled ? infoButton : (
        <Tooltip>
          <TooltipTrigger asChild>{infoButton}</TooltipTrigger>
          <TooltipContent
          side="top"
          align="end"
          sideOffset={10}
          showArrow={false}
          className="relative z-[80] bg-transparent p-0 shadow-none"
        >
          <div className="box-content w-[260px] max-w-[calc(100vw-80px)] translate-x-[10px] rounded-[10px] border border-[var(--shapeships-grey-70)] bg-[var(--shapeships-grey-90)] px-[24px] pb-[32px] pt-[24px] font-['Roboto'] text-[16px] font-normal leading-[19px] text-white shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
            <div className="flex flex-col gap-[24px]">
              <p>When you press READY, autocast spends all your remaining energy:</p>
              <div className="grid grid-cols-3 gap-[24px] items-start">
                {AUTOCAST_TOOLTIP_PATHS.map((path) => (
                  <div key={path.powerNames[0]} className="flex min-w-0 flex-col gap-[8px]">
                    <span
                      aria-hidden="true"
                      className="size-[14px] shrink-0 rounded-full"
                      style={{ backgroundColor: path.color }}
                    />
                    <div className="flex flex-col items-start">
                      {path.powerNames.map((powerName, index) => (
                        <div key={powerName} className="flex flex-col items-start">
                          {index > 0 && <span aria-hidden="true">🡫</span>}
                          <span>{powerName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p>Simulacrum and multicolour Powers must be cast manually.</p>
            </div>
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[-6px] right-[6px] size-[12px] rotate-45 border-b border-r border-solid border-[var(--shapeships-grey-70)] bg-[var(--shapeships-grey-90)]"
          />
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

export function AncientShipCataloguePanel({
  actions,
  buildCatalogue,
  frame = 'desktop',
  catalogueLayout = 'standard',
  hoverDisabled,
  interactionDisabled = false,
  onShipInspect,
  simulacrumSpecies = 'human',
  presentation = 'reference',
  catalogueEnergy,
  declarationEnergy,
  declarationEnergyCapacity,
  declarationStage,
  canCastManualSolarPowerById,
  solarHoverValuesById,
  selectorMode = null,
  siphonSelector,
  simulacrumSelector,
  blackHoleSelector,
  autocastEnabled,
  autocastDisabled = false,
  declarationAttemptUnresolved = false,
  declarationBlocked = false,
}: AncientShipCataloguePanelProps) {
  const hover = useShipCatalogueHover(hoverDisabled);
  const [hoveredSiphonSpend, setHoveredSiphonSpend] = useState<number | null>(null);
  const isBuildableContext = buildCatalogue.context === 'buildable';
  const isUnavailableContext = buildCatalogue.context === 'unavailable';
  const canvas = ANCIENT_CATALOGUE_CANVAS_BY_LAYOUT[catalogueLayout];
  const solarHeaderPositions = SOLAR_HEADER_POSITIONS[catalogueLayout];
  const energyHeaderPosition = ANCIENT_ENERGY_HEADER_POSITION_BY_LAYOUT[catalogueLayout];
  const SimulacrumGraphic = SIMULACRUM_GRAPHICS[simulacrumSpecies] ?? SimulacrumHuman;
  const isDeclarationPresentation = presentation === 'declaration';
  const isLiveCatalogue =
    isDeclarationPresentation || buildCatalogue.context !== 'reference_only';
  const isDeclarationBlocked =
    declarationAttemptUnresolved || declarationBlocked;
  const isActiveResolvedPowersStage =
    isDeclarationPresentation &&
    declarationStage === 'powers' &&
    !isDeclarationBlocked;
  const selectorOpen = selectorMode != null;
  const canOpenSiphonSelector =
    isActiveResolvedPowersStage &&
    siphonSelector?.canOpen === true;
  const canOpenBlackHoleSelector =
    isActiveResolvedPowersStage &&
    blackHoleSelector?.canOpen === true;
  const canOpenSimulacrumSelector =
    isActiveResolvedPowersStage &&
    simulacrumSelector?.canOpen === true &&
    !selectorOpen;
  const isAutocastDisabled =
    autocastDisabled ||
    (isLiveCatalogue && (!isActiveResolvedPowersStage || selectorOpen));
  const siphonSelectorX = SIPHON_SELECTOR_X[catalogueLayout];
  const blackHoleSelectorLayout = BLACK_HOLE_SELECTOR_LAYOUT[catalogueLayout];
  const handleHoveredSiphonSpendChange = useCallback((spend: number | null) => {
    setHoveredSiphonSpend(spend);
  }, []);

  useEffect(() => {
    if (
      selectorMode !== 'siphon' ||
      declarationStage !== 'powers' ||
      isDeclarationBlocked
    ) {
      setHoveredSiphonSpend(null);
    }
  }, [isDeclarationBlocked, declarationStage, selectorMode]);

  useEffect(
    () => () => setHoveredSiphonSpend(null),
    []
  );

  function getSlotProps(shipId: ShipDefId) {
    const canAddShip = buildCatalogue.canAddShipById[shipId] === true;
    const isDimmed =
      isDeclarationPresentation ||
      isUnavailableContext ||
      (isBuildableContext && !canAddShip);
    const enableGraphicHover = shouldEnableCatalogueGraphicHover({
      context: buildCatalogue.context,
      canAddShip,
      hoverDisabled,
    });

    if (onShipInspect) {
      return {
        isDimmed,
        isClickable: true,
        enableGraphicHover,
        onClick: () => onShipInspect(shipId),
      };
    }

    if (interactionDisabled) {
      return {
        isDimmed,
        isClickable: false,
        enableGraphicHover,
      };
    }

    return {
      isDimmed,
      isClickable: isBuildableContext && canAddShip,
      enableGraphicHover,
      onClick: () => actions.onBuildShip(shipId),
    };
  }

  function getDisplayCost(shipId: ShipDefId, fallbackCost: number): number {
    return isBuildableContext
      ? (buildCatalogue.displayCostByShipId[shipId] ?? fallbackCost)
      : fallbackCost;
  }

  const hoveredShipIsSolar = hover.presentState.activeShipId
    ? SOLAR_POWER_IDS.has(hover.presentState.activeShipId)
    : false;
  const hoveredShipEligibility: ShipEligibility | null = hover.presentState.activeShipId
    ? hoveredShipIsSolar
      ? { state: 'REFERENCE_ONLY' }
      : getShipEligibilityForHover({
          shipId: hover.presentState.activeShipId,
          buildCatalogue,
        })
    : null;
  const hoveredSolarHeadingValue =
    hover.presentState.activeShipId && hoveredShipIsSolar
      ? solarHoverValuesById?.[hover.presentState.activeShipId]
      : undefined;
  const hoveredSolarSlot = hover.state.activeShipId
    ? SOLAR_POWER_SLOTS.find((slot) => slot.id === hover.state.activeShipId)
    : undefined;
  let mainIconSpendPreview: AncientEnergySpendPreview | null = null;

  if (
    !selectorOpen &&
    isActiveResolvedPowersStage &&
    hoveredSolarSlot
  ) {
    if (hoveredSolarSlot.id === 'SSIP') {
      if (canOpenSiphonSelector) {
        mainIconSpendPreview = {
          green: ANCIENT_SIPHON_MINIMUM_SPEND,
          red: ANCIENT_SIPHON_MINIMUM_SPEND,
          blue: 0,
        };
      }
    } else if (hoveredSolarSlot.id === 'SSIM') {
      mainIconSpendPreview = null;
    } else if (hoveredSolarSlot.id === 'SBLA') {
      if (canOpenBlackHoleSelector) {
        mainIconSpendPreview = buildEnergySpendPreview(hoveredSolarSlot.costRows);
      }
    } else if (
      isFixedAncientManualSolarPowerId(hoveredSolarSlot.id) &&
      canCastManualSolarPowerById?.[hoveredSolarSlot.id] === true
    ) {
      mainIconSpendPreview = buildEnergySpendPreview(hoveredSolarSlot.costRows);
    }
  }

  const spendPreview: AncientEnergySpendPreview | null =
    selectorMode === 'siphon'
      ? declarationStage !== 'powers' ||
        isDeclarationBlocked ||
        hoveredSiphonSpend === null
        ? null
        : {
            green: hoveredSiphonSpend,
            red: hoveredSiphonSpend,
            blue: 0,
          }
      : selectorMode === 'simulacrum'
        ? declarationStage !== 'powers' ||
          isDeclarationBlocked ||
          simulacrumSelector?.hoveredPreviewBlueCost == null
          ? null
          : {
              green: 0,
              red: 0,
              blue: simulacrumSelector.hoveredPreviewBlueCost,
            }
        : selectorOpen
          ? null
          : mainIconSpendPreview;

  const content = (
    /* Container with exact width matching design */
    <div
      className="relative"
      style={{
        width: `${canvas.width}px`,
        minHeight: `${canvas.height}px`,
        ...(frame === 'bare' ? { height: `${canvas.height}px` } : {}),
      }}
    >

          {/* Section Titles */}
          <p
            className="absolute font-['Roboto'] font-bold leading-[normal] text-[18px] text-white"
            style={{
              left: `${ANCIENT_CATALOGUE_SECTION_X.basics}px`,
              top: "0",
              fontVariationSettings: "'wdth' 100",
            }}
          >
            Ancient Basic Ships
          </p>

          <p
            className="absolute font-['Roboto'] font-bold leading-[normal] text-[18px] text-white"
            style={{
              left: `${ANCIENT_CATALOGUE_SECTION_X.solar}px`,
              top: "0",
              fontVariationSettings: "'wdth' 100",
            }}
          >
            Ancient Solar Powers
          </p>

          {/* Vertical Divider */}
          <div
            className="absolute bg-[var(--shapeships-grey-70)]"
            style={{
              left: "407px",
              top: "0",
              width: "1px",
              height: `${canvas.height}px`,
            }}
          />

          {/* ================ LEFT HALF: BASIC SHIPS (CLICKABLE) ================ */}

          {/* Basic Ships Row 1 */}
          <div
            className="absolute content-stretch flex items-end justify-between"
            style={{ left: "0px", top: "25px", width: "386px" }}
          >
            {/* Pluto Core */}
            <div
              className="content-stretch flex flex-col gap-[8px] items-center shrink-0"
              style={{ width: "40px" }}
              onMouseEnter={(e) =>
                hover.onEnter("PLU", e.currentTarget)
              }
              onMouseLeave={() => hover.onLeave("PLU")}
            >
              <CatalogueShipSlot
                shipId="PLU"
                graphic={
                  <div
                    className="relative shrink-0"
                    style={{ height: "70px", width: "40px" }}
                  >
                    <PlutoCore />
                  </div>
                }
                {...getSlotProps("PLU")}
              >
                <CatalogueCostNumber
                  cost={getDisplayCost("PLU", 3)}
                  className="relative shrink-0 w-full"
                />
              </CatalogueShipSlot>
            </div>

            {/* Mercury Core */}
            <div
              className="content-stretch flex flex-col gap-[8px] items-center shrink-0"
              style={{ width: "40px" }}
              onMouseEnter={(e) =>
                hover.onEnter("MER", e.currentTarget)
              }
              onMouseLeave={() => hover.onLeave("MER")}
            >
              <CatalogueShipSlot
                shipId="MER"
                graphic={
                  <div
                    className="relative shrink-0"
                    style={{ height: "85px", width: "40px" }}
                  >
                    <MercuryCore />
                  </div>
                }
                {...getSlotProps("MER")}
              >
                <CatalogueCostNumber
                  cost={getDisplayCost("MER", 4)}
                  className="relative shrink-0 w-full"
                />
              </CatalogueShipSlot>
            </div>

            {/* Quantum Mystic */}
            <div
              className="content-stretch flex flex-col gap-[8px] items-center shrink-0"
              style={{ width: "90px" }}
              onMouseEnter={(e) =>
                hover.onEnter("QUA", e.currentTarget)
              }
              onMouseLeave={() => hover.onLeave("QUA")}
            >
              <CatalogueShipSlot
                shipId="QUA"
                graphic={
                  <div
                    className="relative shrink-0"
                    style={{ height: "57px", width: "90px" }}
                  >
                    <QuantumMystic />
                  </div>
                }
                {...getSlotProps("QUA")}
              >
                <CatalogueCostNumber
                  cost={getDisplayCost("QUA", 5)}
                  className="relative shrink-0 w-full"
                />
              </CatalogueShipSlot>
            </div>

            {/* Spiral */}
            <div
              className="content-stretch flex flex-col gap-[8px] items-center shrink-0"
              style={{ width: "60px" }}
              onMouseEnter={(e) =>
                hover.onEnter("SPI", e.currentTarget)
              }
              onMouseLeave={() => hover.onLeave("SPI")}
            >
              <CatalogueShipSlot
                shipId="SPI"
                graphic={
                  <div
                    className="relative shrink-0"
                    style={{ height: "60px", width: "60px" }}
                  >
                    <Spiral />
                  </div>
                }
                {...getSlotProps("SPI")}
              >
                <CatalogueCostNumber
                  cost={getDisplayCost("SPI", 6)}
                  className="relative shrink-0 w-full"
                />
              </CatalogueShipSlot>
            </div>
          </div>

          {/* Basic Ships Row 2 */}
          <div
            className="absolute content-stretch flex items-center justify-between px-[16px]"
            style={{
              left: "-5px",
              top: "151px",
              width: "396px",
            }}
          >
            {/* Neptune Core */}
            <div
              className="content-stretch flex flex-col gap-[8px] items-center shrink-0"
              style={{ width: "70px" }}
              onMouseEnter={(e) =>
                hover.onEnter("NEP", e.currentTarget)
              }
              onMouseLeave={() => hover.onLeave("NEP")}
            >
              <CatalogueShipSlot
                shipId="NEP"
                graphic={
                  <div
                    className="relative shrink-0"
                    style={{ height: "70px", width: "70px" }}
                  >
                    <NeptuneCore />
                  </div>
                }
                {...getSlotProps("NEP")}
              >
                <CatalogueCostNumber
                  cost={getDisplayCost("NEP", 7)}
                  className="relative shrink-0 w-full"
                />
              </CatalogueShipSlot>
            </div>

            {/* Solar Reserve (use SolarReserve4 as default) */}
            <div
              className="content-stretch flex flex-col gap-[8px] items-center shrink-0"
              style={{ width: "80px" }}
              onMouseEnter={(e) =>
                hover.onEnter("SOL", e.currentTarget)
              }
              onMouseLeave={() => hover.onLeave("SOL")}
            >
              <CatalogueShipSlot
                shipId="SOL"
                graphic={
                  <div
                    className="relative shrink-0"
                    style={{ height: "85px", width: "80px" }}
                  >
                    <SolarReserve4 />
                  </div>
                }
                {...getSlotProps("SOL")}
              >
                <CatalogueCostNumber
                  cost={getDisplayCost("SOL", 8)}
                  className="relative shrink-0 w-full"
                />
              </CatalogueShipSlot>
            </div>

            {/* Cube */}
            <div
              className="content-stretch flex flex-col gap-[8px] items-center shrink-0"
              style={{ width: "70px" }}
              onMouseEnter={(e) =>
                hover.onEnter("CUB", e.currentTarget)
              }
              onMouseLeave={() => hover.onLeave("CUB")}
            >
              <CatalogueShipSlot
                shipId="CUB"
                graphic={
                  <div
                    className="relative shrink-0"
                    style={{ height: "70px", width: "70px" }}
                  >
                    <Cube />
                  </div>
                }
                {...getSlotProps("CUB")}
              >
                <CatalogueCostNumber
                  cost={getDisplayCost("CUB", 9)}
                  className="relative shrink-0 w-full"
                />
              </CatalogueShipSlot>
            </div>
          </div>

          {/* ================ RIGHT HALF: SOLAR POWERS ================ */}

          <div
            className="absolute"
            style={{
              left: energyHeaderPosition.x,
              top: energyHeaderPosition.y,
            }}
          >
            {isDeclarationPresentation ? (
              <AncientEnergyDisplay
                mode="active"
                pool={declarationEnergy ?? ZERO_ANCIENT_ENERGY_POOL}
                capacity={declarationEnergyCapacity ?? ZERO_ANCIENT_ENERGY_POOL}
                spendPreview={spendPreview}
              />
            ) : (
              <AncientEnergyDisplay {...(catalogueEnergy ?? REFERENCE_ANCIENT_CATALOGUE_ENERGY)} />
            )}
          </div>

          <AncientAutocastControl
            className="absolute"
            style={{
              left: solarHeaderPositions.x,
              top: solarHeaderPositions.y,
            }}
            checked={autocastEnabled}
            disabled={isAutocastDisabled}
            onChange={actions.onSetAncientAutocastEnabled}
          />

          {selectorOpen ? (
            <>
              <button
                type="button"
                className="absolute cursor-pointer rounded-[10px] border-0 bg-[var(--shapeships-grey-90)] px-[16px] py-[6px] font-['Roboto'] text-[16px] font-normal leading-normal text-white hover:bg-[var(--shapeships-grey-70)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
                style={{ left: '426px', top: '30px', fontVariationSettings: "'wdth' 100" }}
                onClick={() => {
                  setHoveredSiphonSpend(null);
                  actions.onCancelAncientSolarSelector();
                }}
              >
                Back
              </button>
              {selectorMode === 'siphon' ? (
                <AncientSiphonSelector
                  maxSpend={siphonSelector?.maxSpend ?? 0}
                  availableWidth={canvas.width - siphonSelectorX}
                  x={siphonSelectorX}
                  onSelect={actions.onCastAncientSiphon}
                  onHoveredSpendChange={handleHoveredSiphonSpendChange}
                />
              ) : selectorMode === 'blackHole' ? (
                <AncientBlackHoleSelector
                  damagePreview={blackHoleSelector?.damagePreview ?? 0}
                  {...blackHoleSelectorLayout}
                />
              ) : selectorMode === 'simulacrum' ? (
                <AncientSimulacrumSelector
                  graphic={SimulacrumGraphic}
                  blueAvailable={simulacrumSelector?.blueAvailable ?? 0}
                  layout={catalogueLayout}
                />
              ) : null}
            </>
          ) : SOLAR_POWER_SLOTS.map((slot) => {
            const position = slot.position[catalogueLayout];
            const Graphic = slot.id === 'SSIM' ? SimulacrumGraphic : slot.graphic;
            const manualSolarPowerId = isFixedAncientManualSolarPowerId(slot.id)
              ? slot.id
              : null;
            const isManualCastButton =
              isDeclarationPresentation &&
              declarationStage === 'powers' &&
              manualSolarPowerId != null;
            const canCast =
              manualSolarPowerId != null &&
              canCastManualSolarPowerById?.[manualSolarPowerId] === true;
            const isSolarUsable =
              manualSolarPowerId != null
                ? canCast
                : slot.id === 'SSIP'
                  ? canOpenSiphonSelector
                  : slot.id === 'SSIM'
                    ? canOpenSimulacrumSelector
                    : slot.id === 'SBLA'
                      ? canOpenBlackHoleSelector
                      : false;
            const isSolarDimmed =
              isLiveCatalogue &&
              (!isActiveResolvedPowersStage || !isSolarUsable);

            return (
              <div
                key={slot.id}
                className="absolute"
                data-solar-power-id={slot.id}
                style={{
                  left: position.x,
                  top: position.y,
                }}
              >
                <AncientSolarPowerSlot
                  graphic={Graphic}
                  isDimmed={isSolarDimmed}
                  costRows={slot.costRows}
                  costPlacement={
                    'costPlacement' in slot ? slot.costPlacement : undefined
                  }
                  showPlus={'showPlus' in slot && slot.showPlus}
                  onClick={
                    isManualCastButton && manualSolarPowerId && canCast && !isDeclarationBlocked
                      ? () => actions.onCastAncientSolarPower(manualSolarPowerId)
                      : slot.id === 'SSIP' && canOpenSiphonSelector
                        ? () => {
                            hover.onLeave(slot.id);
                            actions.onOpenAncientSolarSelector('siphon');
                          }
                      : slot.id === 'SBLA' && canOpenBlackHoleSelector
                        ? () => {
                            hover.onLeave(slot.id);
                            actions.onOpenAncientSolarSelector('blackHole');
                          }
                      : slot.id === 'SSIM' && canOpenSimulacrumSelector
                        ? () => {
                            hover.onLeave(slot.id);
                            actions.onOpenAncientSolarSelector('simulacrum');
                          }
                      : undefined
                  }
                  ariaLabel={
                    isManualCastButton && manualSolarPowerId
                      ? `Cast ${MANUAL_SOLAR_POWER_LABEL_BY_ID[manualSolarPowerId]}`
                      : slot.id === 'SSIP' && canOpenSiphonSelector
                        ? 'Choose Siphon Energy spend'
                      : slot.id === 'SBLA' && canOpenBlackHoleSelector
                        ? 'Cast Black Hole'
                      : slot.id === 'SSIM' && canOpenSimulacrumSelector
                        ? 'Choose Simulacrum target'
                      : undefined
                  }
                  onMouseEnter={
                    hoverDisabled
                      ? undefined
                      : (event) => hover.onEnter(slot.id, event.currentTarget)
                  }
                  onMouseLeave={
                    hoverDisabled
                      ? undefined
                      : () => hover.onLeave(slot.id)
                  }
                />
              </div>
            );
          })}
        </div>
      );

  return (
    <>
      {frame === 'desktop' ? <ActionPanelScrollArea>{content}</ActionPanelScrollArea> : content}

      {/* Single hover card rendered via the existing shared catalogue hover path */}
      {!hoverDisabled &&
        hover.presentState.activeShipId &&
        hover.presentState.anchorRect &&
        hoveredShipEligibility && (
          <ShipHoverCard
            shipId={hover.presentState.activeShipId}
            anchorRect={hover.presentState.anchorRect}
            eligibility={hoveredShipEligibility}
            motionState={hover.motionState}
            showCost={!hoveredShipIsSolar}
            headingValue={hoveredSolarHeadingValue}
            showPhaseLabel={!hoveredShipIsSolar}
          />
        )}
    </>
  );
}
