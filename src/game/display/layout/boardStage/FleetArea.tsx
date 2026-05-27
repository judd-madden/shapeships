import type { FleetAreaHealthDeltaFlashVm } from '../../../client/useGameSession';
import { getShipDefinitionUI } from '../../../data/ShipDefinitionsUI';
import type { ShipDefId } from '../../../types/ShipTypes.engine';
import {
  ShipAnimationWrapper,
  type ShipAnimToken,
  type TurnIncrementPulseState,
  getTargetingGlowClassName,
  getTargetingGlowStyle,
  getTargetingPreviewStyle,
  getTargetingVisualState,
} from '../../graphics/animation';
import { resolveShipGraphic } from '../../graphics/resolveShipGraphic';
import { useFlipLayout } from '../../graphics/useFlipLayout';
import { FitToBox } from './FitToBox';
import { FleetAreaHealthDeltaFlash } from './FleetAreaHealthDeltaFlash';
import type { FleetAreaHealthDeltaFlashShape } from './FleetAreaHealthDeltaFlash';

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ');
}

function toCssVarFromColourName(colour?: string): string | undefined {
  if (!colour) return undefined;
  const slug = colour.trim().toLowerCase().replace(/\s+/g, '-');
  return `var(--shapeships-${slug})`;
}

const IGNORED_FLIP_ANCESTOR_SCALE_CLASS_NAMES = ['ss-boardTurnPulse'] as const;

// ============================================================================
// FLEET ROW MAPPING (Set-based, All Species)
// ============================================================================

export type FleetRow = 1 | 2 | 3 | 4;
export type FleetRowOverrides = Partial<Record<ShipDefId, FleetRow>>;
export type SpeciesKey = 'human' | 'xenite' | 'centaur' | 'ancient';
type RowSets = Record<FleetRow, Set<ShipDefId>>;

const HUMAN_ROW_SETS: RowSets = {
  1: new Set<ShipDefId>(['ORB', 'STA', 'BAT', 'SCI']),
  2: new Set<ShipDefId>(['CAR']),
  3: new Set<ShipDefId>(['DEF', 'FIG', 'COM', 'INT']),
  4: new Set<ShipDefId>(['FRI', 'TAC', 'GUA', 'EAR', 'DRE', 'LEV']),
};

const XENITE_ROW_SETS: RowSets = {
  1: new Set<ShipDefId>(['ZEN', 'BUG', 'QUE']),
  2: new Set<ShipDefId>(['XEN', 'ANT', 'EVO', 'AST', 'OXI']),
  3: new Set<ShipDefId>(['MAN', 'HEL', 'DSW', 'AAR']),
  4: new Set<ShipDefId>(['OXF', 'ASF', 'SAC', 'CHR', 'HVE']),
};

const CENTAUR_ROW_SETS: RowSets = {
  1: new Set<ShipDefId>(['VIG', 'POW', 'RED', 'KNO']),
  2: new Set<ShipDefId>(['LEG', 'FEA', 'ANG', 'TER', 'FUR', 'ENT']),
  3: new Set<ShipDefId>(['WIS', 'FAM']),
  4: new Set<ShipDefId>(['EQU', 'DES', 'DOM']),
};

const ANCIENT_ROW_SETS: RowSets = {
  1: new Set<ShipDefId>(['MER', 'PLU', 'QUA', 'URA']),
  2: new Set<ShipDefId>(['SOL']),
  3: new Set<ShipDefId>(['SPI', 'CUB']),
  4: new Set<ShipDefId>([]), // Reserved for later text-only powers
};

const ROW_SETS_BY_SPECIES: Record<SpeciesKey, RowSets> = {
  human: HUMAN_ROW_SETS,
  xenite: XENITE_ROW_SETS,
  centaur: CENTAUR_ROW_SETS,
  ancient: ANCIENT_ROW_SETS,
};

function getRowFromSets(
  shipDefId: ShipDefId,
  rowSets: RowSets,
  liveRowOverrides?: FleetRowOverrides
): FleetRow {
  const overrideRow = liveRowOverrides?.[shipDefId];
  if (overrideRow !== undefined) return overrideRow;

  if (rowSets[1].has(shipDefId)) return 1;
  if (rowSets[2].has(shipDefId)) return 2;
  if (rowSets[3].has(shipDefId)) return 3;
  if (rowSets[4].has(shipDefId)) return 4;
  return 4; // fallback for unknown/copied ships
}

function sortByPersistentOrder<T extends { shipDefId: string; renderKey: string }>(
    ships: T[],
    order?: string[]
): T[] {
    const index = new Map<string, number>();
    (order ?? []).forEach((id, i) => index.set(id, i));

    return [...ships].sort((a, b) => {
        const ai = index.has(a.renderKey) ? index.get(a.renderKey)! : Number.POSITIVE_INFINITY;
        const bi = index.has(b.renderKey) ? index.get(b.renderKey)! : Number.POSITIVE_INFINITY;
        if (ai !== bi) return ai - bi;
        return a.renderKey.localeCompare(b.renderKey);
    });
}

function groupShipsIntoRows<T extends { shipDefId: string; renderKey: string }>(
    ships: T[],
    order: string[] | undefined,
    rowSets: RowSets,
    liveRowOverrides?: FleetRowOverrides
) {
    const sorted = sortByPersistentOrder(ships, order);

    const row1: T[] = [];
    const row2: T[] = [];
    const row3: T[] = [];
    const row4: T[] = [];

    for (const s of sorted) {
        const id = s.shipDefId as ShipDefId;
        const row = getRowFromSets(id, rowSets, liveRowOverrides);
        if (row === 1) row1.push(s);
        else if (row === 2) row2.push(s);
        else if (row === 3) row3.push(s);
        else row4.push(s);
    }

    return { row1, row2, row3, row4 };
}

type FleetStackVm = {
  shipDefId: string;
  count: number;
  stackKey: string;
  renderKey: string;
  condition?: 'charges_1' | 'charges_0';
  currentCharges?: number | null;
  caption?: string | null;
};

function getLiveFleetLayoutSignature(
  renderedShips: FleetStackVm[],
  liveRowsLayout: 'stacked' | 'pairedRows'
): string {
  return JSON.stringify([
    liveRowsLayout,
    renderedShips.map((ship) => [
      ship.renderKey,
      ship.count,
      ship.condition ?? null,
      ship.currentCharges ?? null,
      ship.caption ?? null,
    ]),
  ]);
}

function getLiveFleetItemLayoutSignatures(
  renderedShips: FleetStackVm[]
): Record<string, string> {
  return Object.fromEntries(
    renderedShips.map((ship) => [
      ship.renderKey,
      JSON.stringify([
        ship.shipDefId,
        ship.count,
        ship.condition ?? null,
        ship.currentCharges ?? null,
        ship.caption ?? null,
      ]),
    ])
  );
}

type ShipDisplayMode = 'live' | 'void';

type DestroyTargetStateVm = {
  isTargetable: boolean;
  isHovered: boolean;
  isSelected: boolean;
};

export function toSpeciesKey(raw: unknown): SpeciesKey {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'human' || s === 'xenite' || s === 'centaur' || s === 'ancient') return s;
  return 'human'; // Safe fallback
}

function ShipStack({ 
  ship, 
  animToken, 
  activationIndexMap,
  targetState,
  previewShipDefId,
  targetingGlowScale,
  displayMode = 'live',
  onFleetHoverEnter,
  onFleetHoverLeave,
  onFleetShipTap,
}: { 
  ship: FleetStackVm;
  animToken?: ShipAnimToken;
  activationIndexMap?: Record<string, number>;
  targetState?: DestroyTargetStateVm;
  previewShipDefId?: ShipDefId;
  targetingGlowScale?: number;
  displayMode?: ShipDisplayMode;
  onFleetHoverEnter?: (shipId: ShipDefId, anchorEl: HTMLElement) => void;
  onFleetHoverLeave?: (shipId: ShipDefId) => void;
  onFleetShipTap?: (shipId: ShipDefId, anchorEl: HTMLElement) => void;
}) {
  const shipDefId = ship.shipDefId as ShipDefId;
  const def = getShipDefinitionUI(shipDefId);
  const isVoid = displayMode === 'void';

  // If this fleet stack has a condition like 'charges_1' or 'charges_0',
  // force that exact charge graphic on the live board via explicitCharges.
  let explicitCharges: number | undefined = undefined;
  if (ship.condition && ship.condition.startsWith('charges_')) {
    const match = ship.condition.match(/^charges_(\d+)$/);
    if (match) {
      explicitCharges = parseInt(match[1], 10);
    }
  }

  const resolvedGraphic = def
    ? resolveShipGraphic(def, {
        context: 'live',
        explicitCharges,
        currentCharges: ship.currentCharges ?? null,
      })
    : null;

  const ShipGraphic = resolvedGraphic?.component;
  const targetingVisualState = isVoid ? null : getTargetingVisualState(targetState);
  const previewDef =
    !isVoid && previewShipDefId ? getShipDefinitionUI(previewShipDefId) : undefined;
  const previewGraphic = previewDef
    ? resolveShipGraphic(previewDef, { context: 'default' })
    : null;
  const PreviewShipGraphic = previewGraphic?.component;
  const numberColour = toCssVarFromColourName(def?.colour);
  
  // Enable hover activation for ships with animation presets (Human + Xenite + Centaur ships)
  const enableHover =
    !isVoid &&
    ['DEF', 'FIG', 'INT', 'COM', 'ORB', 'CAR', 'STA', 'FRI', 'TAC', 'GUA', 'SCI', 'BAT', 'EAR', 'DRE', 'LEV', 'XEN', 'ANT', 'MAN', 'EVO', 'HEL', 'BUG', 'ZEN', 'DSW', 'AAR', 'OXF', 'ASF', 'SAC', 'QUE', 'CHR', 'HVE', 'FEA', 'ANG', 'EQU', 'WIS', 'VIG', 'FAM', 'LEG', 'TER', 'FUR', 'KNO', 'ENT', 'RED', 'POW', 'DES', 'DOM'].includes(ship.shipDefId);

  const showCount = ship.count > 1;

  const activationDelayMs = (activationIndexMap?.[ship.renderKey] ?? 0) * 400;

  return (
    <div className={cx('flex flex-row items-center', isVoid && 'opacity-35')}>
      <div className="flex flex-col items-center justify-center">
        <div className="relative flex items-center justify-center">
          {targetingVisualState ? (
            <div
              className={getTargetingGlowClassName(targetingVisualState)}
              style={getTargetingGlowStyle(targetingVisualState, targetingGlowScale)}
            />
          ) : null}

          {PreviewShipGraphic && targetingVisualState && targetingVisualState !== 'available' ? (
            <div
              className="ss-targeting-preview z-20"
              style={getTargetingPreviewStyle(targetingVisualState)}
            >
              <PreviewShipGraphic />
            </div>
          ) : null}

          <div
            className={cx(
              'relative z-10',
              isVoid && '[&_svg]:h-auto [&_svg]:w-auto'
            )}
          >
            <ShipAnimationWrapper 
              shipDefId={shipDefId} 
              token={animToken}
              enableHoverActivation={enableHover}
              activationDelayMs={activationDelayMs}
            >
              <div
                className="inline-block shrink-0 align-top p-0 m-0"
                style={{ lineHeight: 0 }}
                onMouseEnter={
                  !isVoid
                    ? (event) => onFleetHoverEnter?.(shipDefId, event.currentTarget)
                    : undefined
                }
                onMouseLeave={
                  !isVoid
                    ? () => onFleetHoverLeave?.(shipDefId)
                    : undefined
                }
                onClick={
                  !isVoid && onFleetShipTap
                    ? (event) => onFleetShipTap(shipDefId, event.currentTarget)
                    : undefined
                }
              >
                {ShipGraphic ? (
                  <ShipGraphic />
                ) : (
                  <span className={cx('text-sm text-white')}>{ship.shipDefId}</span>
                )}
              </div>
            </ShipAnimationWrapper>
          </div>
        </div>

        {ship.shipDefId === 'FRI' && ship.caption ? (
          <div
            className={cx(
              "relative z-10 mt-[4px] font-['Roboto'] font-normal leading-none text-center text-[14px]"
            )}
            style={{
              color: numberColour ?? 'white',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {ship.caption}
          </div>
        ) : null}
      </div>

      {/* Count: only render when count > 1 */}
      {showCount ? (
        <div className={cx('relative z-10 ml-[8px]')}>
          <div
            className={cx("font-['Roboto'] font-semibold")}
            style={{
              fontSize: '50px',
              lineHeight: 1,
              fontVariationSettings: "'wdth' 100",
              color: numberColour ?? 'white',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {ship.count}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function FleetArea({
  title,
  ships,
  voidShips,
  order,
  species,
  animTokens,
  flipEnabled = false,
  side,
  activationIndexMap,
  healthDeltaFlash,
  healthDeltaFlashShape,
  targetStatesByStackKey,
  previewShipDefIdByStackKey,
  targetingGlowScale,
  onDestroyTargetHoverChange,
  onDestroyTargetMouseDown,
  onFleetHoverEnter,
  onFleetHoverLeave,
  onFleetShipTap,
  turnPulse,
  fitMinScale = 0.4,
  liveFitOverflowVisible,
  liveRowsLayout = 'stacked',
  liveLayoutCanvasClassName,
  voidSlotClassName = 'h-[44px]',
  voidScaleClassName = 'scale-[0.6]',
  voidGapClassName = 'gap-[20px]',
  fitVoidToSlot = false,
  voidFitMinScale = 0.15,
  voidFitMaxScale = 0.6,
  liveRowOverrides,
}: {
  title: string;
  ships?: FleetStackVm[];
  voidShips?: FleetStackVm[];
  order?: string[];
  species: SpeciesKey;
  animTokens?: Partial<Record<string, ShipAnimToken>>; // keyed by renderKey
  flipEnabled?: boolean;
  side: 'my' | 'opponent';
  activationIndexMap?: Record<string, number>;
  healthDeltaFlash?: FleetAreaHealthDeltaFlashVm;
  healthDeltaFlashShape?: FleetAreaHealthDeltaFlashShape;
  targetStatesByStackKey?: Record<string, DestroyTargetStateVm>;
  previewShipDefIdByStackKey?: Partial<Record<string, ShipDefId>>;
  targetingGlowScale?: number;
  onDestroyTargetHoverChange?: (side: 'my' | 'opponent', stackKey: string | null) => void;
  onDestroyTargetMouseDown?: (side: 'my' | 'opponent', stackKey: string) => void;
  onFleetHoverEnter?: (shipId: ShipDefId, anchorEl: HTMLElement) => void;
  onFleetHoverLeave?: (shipId: ShipDefId) => void;
  onFleetShipTap?: (shipId: ShipDefId, anchorEl: HTMLElement) => void;
  turnPulse: TurnIncrementPulseState;
  fitMinScale?: number;
  liveFitOverflowVisible?: boolean;
  liveRowsLayout?: 'stacked' | 'pairedRows';
  liveLayoutCanvasClassName?: string;
  voidSlotClassName?: string;
  voidScaleClassName?: string;
  voidGapClassName?: string;
  fitVoidToSlot?: boolean;
  voidFitMinScale?: number;
  voidFitMaxScale?: number;
  liveRowOverrides?: FleetRowOverrides;
}) {
  const rowSets = ROW_SETS_BY_SPECIES[species];
  const grouped =
    ships && ships.length > 0
      ? groupShipsIntoRows(ships, order, rowSets, liveRowOverrides)
      : null;
  const sortedVoidShips = voidShips && voidShips.length > 0 ? sortByPersistentOrder(voidShips, order) : [];

  // FLIP layout animation for smooth repositioning (live fleet only)
  // Derive keys from rendered ships in stable order
  const renderedShips = grouped
    ? [...grouped.row1, ...grouped.row2, ...grouped.row3, ...grouped.row4]
    : [];
  const allRenderKeys = renderedShips.map((s) => s.renderKey);
  const liveFleetLayoutSignature = getLiveFleetLayoutSignature(renderedShips, liveRowsLayout);
  const liveFleetItemLayoutSignatures = getLiveFleetItemLayoutSignatures(renderedShips);
  const getFlipRef = useFlipLayout(allRenderKeys, flipEnabled, {
    durationMs: 400,
    easing: 'ease-in-out',
    layoutSignature: liveFleetLayoutSignature,
    itemLayoutSignatures: liveFleetItemLayoutSignatures,
    skipSelfChangedItemForNextRun: false,
    ignoredAncestorScaleClassNames: IGNORED_FLIP_ANCESTOR_SCALE_CLASS_NAMES,
  });

  const renderShipCell = (ship: FleetStackVm, displayMode: ShipDisplayMode = 'live') => {
    const targetState = displayMode === 'live' ? targetStatesByStackKey?.[ship.stackKey] : undefined;
    const isTargetable = targetState?.isTargetable === true;
    const canInspectFleetShip = displayMode === 'live' && !isTargetable && Boolean(onFleetShipTap);

    return (
      <div
        key={ship.renderKey}
        ref={displayMode === 'live' ? getFlipRef(ship.renderKey) : undefined}
        className={cx(
          displayMode === 'void' ? 'relative py-[2px]' : 'relative px-[10px] py-[8px]',
          (isTargetable || canInspectFleetShip) && 'cursor-pointer'
        )}
        onMouseEnter={
          displayMode === 'live' && isTargetable
            ? () => onDestroyTargetHoverChange?.(side, ship.stackKey)
            : undefined
        }
        onMouseLeave={
          displayMode === 'live' && isTargetable
            ? () => onDestroyTargetHoverChange?.(side, null)
            : undefined
        }
        onMouseDown={(event) => {
          if (displayMode === 'live') {
            event.stopPropagation();
          }
          if (displayMode === 'live' && isTargetable) {
            onDestroyTargetMouseDown?.(side, ship.stackKey);
          }
        }}
      >
        <ShipStack 
          ship={ship}
          animToken={displayMode === 'live' ? animTokens?.[ship.renderKey] : undefined}
          activationIndexMap={displayMode === 'live' ? activationIndexMap : undefined}
          targetState={targetState}
          previewShipDefId={displayMode === 'live' ? previewShipDefIdByStackKey?.[ship.stackKey] : undefined}
          targetingGlowScale={displayMode === 'live' ? targetingGlowScale : undefined}
          displayMode={displayMode}
          onFleetHoverEnter={displayMode === 'live' ? onFleetHoverEnter : undefined}
          onFleetHoverLeave={displayMode === 'live' ? onFleetHoverLeave : undefined}
          onFleetShipTap={canInspectFleetShip ? onFleetShipTap : undefined}
        />
      </div>
    );
  };

  const renderLiveRow = (rowShips: FleetStackVm[], className = 'justify-start gap-[30px]') => (
    <div className={cx('flex flex-row flex-nowrap items-center', className)}>
      {rowShips.map((ship) => renderShipCell(ship, 'live'))}
    </div>
  );

  const renderPairedBand = (leftRowShips: FleetStackVm[], rightRowShips: FleetStackVm[]) => {
    const hasLeft = leftRowShips.length > 0;
    const hasRight = rightRowShips.length > 0;

    if (!hasLeft && !hasRight) {
      return null;
    }

    if (!hasLeft || !hasRight) {
      return (
        <div className="flex w-full items-center justify-center gap-[18px]">
          {hasLeft
            ? renderLiveRow(leftRowShips, 'justify-center gap-[18px]')
            : renderLiveRow(rightRowShips, 'justify-center gap-[18px]')}
        </div>
      );
    }

    return (
      <div className="flex w-full items-center justify-center gap-[18px]">
        <div className="flex min-w-0 items-center justify-end">
          {renderLiveRow(leftRowShips, 'justify-end gap-[18px]')}
        </div>
        <div className="flex min-w-0 items-center justify-start">
          {renderLiveRow(rightRowShips, 'justify-start gap-[18px]')}
        </div>
      </div>
    );
  };

  const hasLiveShips = renderedShips.length > 0;
  const hasVoidShips = sortedVoidShips.length > 0;
  const liveRowsClassName =
    liveRowsLayout === 'pairedRows'
      ? 'ss-boardTurnPulse flex h-full w-full flex-col items-center justify-center gap-[12px]'
      : 'ss-boardTurnPulse flex flex-col items-center gap-[18px]';
  const voidRow = (
    <div
      className={cx(
        'flex flex-row flex-nowrap items-center',
        voidGapClassName,
        !fitVoidToSlot && voidScaleClassName,
        !fitVoidToSlot && (side === 'opponent' ? 'origin-right' : 'origin-left')
      )}
    >
      {sortedVoidShips.map((ship) => renderShipCell(ship, 'void'))}
    </div>
  );

  return (
    <div className="basis-0 grow h-full min-h-px min-w-px relative shrink-0 px-[8px] overflow-visible">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <FleetAreaHealthDeltaFlash vm={healthDeltaFlash} shape={healthDeltaFlashShape} />
      </div>

      {/* FleetArea: {title} (title intentionally not rendered) */}
      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <div className="grow min-h-0">
          <FitToBox
            minScale={fitMinScale}
            className="w-full h-full"
            overflowVisible={liveFitOverflowVisible}
          >
            {hasLiveShips ? (
              <div
                className={cx(
                  liveRowsClassName,
                  liveLayoutCanvasClassName,
                  turnPulse.isActive && 'ss-boardTurnPulse-active'
                )}
                onAnimationEnd={turnPulse.onAnimationEnd}
              >
                {grouped && liveRowsLayout === 'pairedRows' ? (
                  <>
                    {renderPairedBand(grouped.row1, grouped.row2)}
                    {renderPairedBand(grouped.row3, grouped.row4)}
                  </>
                ) : grouped ? (
                  <>
                    {renderLiveRow(grouped.row1)}
                    {renderLiveRow(grouped.row2)}
                    {renderLiveRow(grouped.row3)}
                    {renderLiveRow(grouped.row4)}
                  </>
                ) : null}
              </div>
            ) : null}
          </FitToBox>
        </div>

         {hasVoidShips ? (
          <div
            className={cx(
              voidSlotClassName,
              fitVoidToSlot ? 'overflow-hidden' : 'overflow-visible',
              side === 'opponent' ? 'flex justify-end' : 'flex justify-start'
            )}
          >
            {fitVoidToSlot ? (
              <FitToBox
                minScale={voidFitMinScale}
                maxScale={voidFitMaxScale}
                className="w-full h-full"
                contentAlign={side === 'opponent' ? 'end' : 'start'}
              >
                {voidRow}
              </FitToBox>
            ) : (
              voidRow
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
