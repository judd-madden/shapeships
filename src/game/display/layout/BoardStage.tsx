/**
 * Board Stage
 * Main game board with 3 columns: P1 Fleet | Health/Stats | P2 Fleet
 * NO LOGIC - displays view-model data only (Pass 1.25)
 */

import { useEffect, useRef, useState } from 'react';
import type { BoardViewModel, GameSessionActions } from '../../client/useGameSession';
import { ChooseSpeciesStage } from './boardModes/ChooseSpeciesStage';
import { getShipDefinitionUI } from '../../data/ShipDefinitionsUI';
import type { ShipDefId } from '../../types/ShipTypes.engine';
import { FitToBox } from './FitToBox';
import { ShipAnimationWrapper, type ShipAnimToken } from '../graphics/animation';
import { useFlipLayout } from '../graphics/useFlipLayout';
import { resolveShipGraphic } from '../graphics/resolveShipGraphic';

interface BoardStageProps {
  vm: BoardViewModel;
  actions: GameSessionActions;
}

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ');
}

function useAnimatedHealth(targetValue: number): number {
  const [displayedValue, setDisplayedValue] = useState(targetValue);
  const rafRef = useRef<number | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      setDisplayedValue(targetValue);
      return;
    }

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    setDisplayedValue((currentValue) => {
      if (currentValue === targetValue) return currentValue;

      const direction = targetValue > currentValue ? 1 : -1;
      const distance = Math.abs(targetValue - currentValue);
      const totalDurationMs = Math.min(300, Math.max(180, distance * 36));
      const stepDurationMs = totalDurationMs / distance;
      const animationStart = performance.now();

      const tick = (now: number) => {
        const elapsed = now - animationStart;
        const stepsCompleted = Math.min(distance, Math.max(1, Math.floor(elapsed / stepDurationMs)));
        const nextValue = currentValue + (stepsCompleted * direction);

        setDisplayedValue(nextValue);

        if (nextValue !== targetValue) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          rafRef.current = null;
        }
      };

      rafRef.current = requestAnimationFrame(tick);
      return currentValue;
    });

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [targetValue]);

  return displayedValue;
}

function toCssVarFromColourName(colour?: string): string | undefined {
  if (!colour) return undefined;
  const slug = colour.trim().toLowerCase().replace(/\s+/g, '-');
  return `var(--shapeships-${slug})`;
}

// ============================================================================
// FLEET ROW MAPPING (Set-based, All Species)
// ============================================================================

type FleetRow = 1 | 2 | 3 | 4;
type SpeciesKey = 'human' | 'xenite' | 'centaur' | 'ancient';
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

function getRowFromSets(shipDefId: ShipDefId, rowSets: RowSets): FleetRow {
  if (rowSets[1].has(shipDefId)) return 1;
  if (rowSets[2].has(shipDefId)) return 2;
  if (rowSets[3].has(shipDefId)) return 3;
  if (rowSets[4].has(shipDefId)) return 4;
  return 4; // fallback for unknown/copied ships
}

function sortByPersistentOrder<T extends { shipDefId: string; count: number }>(
    ships: T[],
    order?: string[]
): T[] {
    const index = new Map<string, number>();
    (order ?? []).forEach((id, i) => index.set(id, i));

    return [...ships].sort((a, b) => {
        const ai = index.has(a.shipDefId) ? index.get(a.shipDefId)! : Number.POSITIVE_INFINITY;
        const bi = index.has(b.shipDefId) ? index.get(b.shipDefId)! : Number.POSITIVE_INFINITY;
        if (ai !== bi) return ai - bi;
        return a.shipDefId.localeCompare(b.shipDefId);
    });
}

function groupShipsIntoRows<T extends { shipDefId: string; count: number }>(
    ships: T[],
    order: string[] | undefined,
    rowSets: RowSets
) {
    const sorted = sortByPersistentOrder(ships, order);

    const row1: T[] = [];
    const row2: T[] = [];
    const row3: T[] = [];
    const row4: T[] = [];

    for (const s of sorted) {
        const id = s.shipDefId as ShipDefId;
        const row = getRowFromSets(id, rowSets);
        if (row === 1) row1.push(s);
        else if (row === 2) row2.push(s);
        else if (row === 3) row3.push(s);
        else row4.push(s);
    }

    return { row1, row2, row3, row4 };
}

function getDestroyTargetSurfaceStyle(targetState?: {
  isTargetable: boolean;
  isHovered: boolean;
  isSelected: boolean;
}) {
  if (!targetState?.isTargetable) {
    return undefined;
  }

  if (targetState.isSelected) {
    return {
      backgroundColor: 'rgba(255, 82, 82, 0.14)',
      borderColor: 'rgba(255, 110, 110, 0.95)',
      boxShadow: '0 0 0 2px rgba(255, 110, 110, 0.95), 0 0 22px rgba(255, 82, 82, 0.4)',
    };
  }

  if (targetState.isHovered) {
    return {
      backgroundColor: 'rgba(255, 255, 255, 0.13)',
      borderColor: 'rgba(255, 255, 255, 0.95)',
      boxShadow: '0 0 0 2px rgba(255, 255, 255, 0.92), 0 0 20px rgba(255, 255, 255, 0.32)',
    };
  }

  return {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.58)',
    boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.58), 0 0 14px rgba(255, 255, 255, 0.18)',
  };
}

function ShipStack({ 
  ship, 
  animToken, 
  side, 
  opponentEntryDelays, 
  activationIndexMap 
}: { 
        ship: {
            shipDefId: string; count: number; condition?: 'charges_1' | 'charges_0'; currentCharges?: number | null; caption?: string | null; };
  animToken?: ShipAnimToken;
  side: 'my' | 'opponent';
  opponentEntryDelays?: Record<string, number>;
  activationIndexMap?: Record<string, number>;
}) {
  const def = getShipDefinitionUI(ship.shipDefId as ShipDefId);

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
  const numberColour = toCssVarFromColourName(def?.colour);
  
  // Enable hover activation for ships with animation presets (Human + Xenite + Centaur ships)
  const enableHover = ['DEF', 'FIG', 'INT', 'COM', 'ORB', 'CAR', 'STA', 'FRI', 'TAC', 'GUA', 'SCI', 'BAT', 'EAR', 'DRE', 'LEV', 'XEN', 'ANT', 'MAN', 'EVO', 'HEL', 'BUG', 'ZEN', 'DSW', 'AAR', 'OXF', 'ASF', 'SAC', 'QUE', 'CHR', 'HVE', 'FEA', 'ANG', 'EQU', 'WIS', 'VIG', 'FAM', 'LEG', 'TER', 'FUR', 'KNO', 'ENT', 'RED', 'POW', 'DES', 'DOM'].includes(ship.shipDefId);

  const showCount = ship.count > 1;

  // Compute animation delays
  const entryDelayMs = side === 'opponent' ? (opponentEntryDelays?.[ship.shipDefId] ?? 0) : 0;
  const activationDelayMs = (activationIndexMap?.[ship.shipDefId] ?? 0) * 400;

  return (
    <div className="flex flex-row items-center">
      <div className="flex flex-col items-center justify-center">
        <ShipAnimationWrapper 
          shipDefId={ship.shipDefId as ShipDefId} 
          token={animToken}
          enableHoverActivation={enableHover}
          entryDelayMs={entryDelayMs}
          activationDelayMs={activationDelayMs}
        >
          {ShipGraphic ? <ShipGraphic /> : <span className="text-white text-sm">{ship.shipDefId}</span>}
        </ShipAnimationWrapper>

              {ship.shipDefId === 'FRI' && ship.caption ? (
                  <div
                      className="mt-[4px] font-['Roboto'] font-normal text-[14px] leading-none text-center"
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
        <div className="ml-[8px]">
          <div
            className="font-['Roboto'] font-semibold"
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

function FleetArea({
  title,
  ships,
  order,
  species,
  animTokens,
  flipEnabled = false,
  side,
  opponentEntryDelays,
  activationIndexMap,
  targetStatesByStackKey,
  onDestroyTargetHoverChange,
  onDestroyTargetMouseDown,
}: {
  title: string;
        ships?: Array<{ shipDefId: string; count: number; stackKey: string; condition?: 'charges_1' | 'charges_0'; currentCharges?: number | null; caption?: string | null; }>;
  order?: string[];
  species: SpeciesKey;
  animTokens?: Partial<Record<string, ShipAnimToken>>; // keyed by stackKey
  flipEnabled?: boolean;
  side: 'my' | 'opponent';
  opponentEntryDelays?: Record<string, number>;
  activationIndexMap?: Record<string, number>;
  targetStatesByStackKey?: Record<string, { isTargetable: boolean; isHovered: boolean; isSelected: boolean }>;
  onDestroyTargetHoverChange?: (stackKey: string | null) => void;
  onDestroyTargetMouseDown?: (stackKey: string) => void;
}) {
  const rowSets = ROW_SETS_BY_SPECIES[species];
  const grouped = ships && ships.length > 0 ? groupShipsIntoRows(ships, order, rowSets) : null;

  // FLIP layout animation for smooth repositioning (live fleet only)
  // Derive keys from rendered ships in stable order
  const renderedShips = grouped
    ? [...grouped.row1, ...grouped.row2, ...grouped.row3, ...grouped.row4]
    : [];
  const allStackKeys = renderedShips.map(s => s.stackKey);
  const getFlipRef = useFlipLayout(allStackKeys, flipEnabled, { durationMs: 400, easing: 'ease-in-out' });

  return (
    <div className="basis-0 grow h-full min-h-px min-w-px relative shrink-0 px-[8px]">
      {/* FleetArea: {title} (title intentionally not rendered) */}
      <FitToBox minScale={0.4} className="w-full h-full">
        {grouped ? (
          <div className="flex flex-col items-center gap-[18px]">
            <div className="flex flex-row flex-nowrap items-center justify-start gap-[30px]">
              {grouped.row1.map((ship) => (
                <div
                  key={ship.stackKey}
                  ref={getFlipRef(ship.stackKey)}
                  className={cx(
                    'rounded-[18px] border border-transparent px-[10px] py-[8px] transition-[background-color,border-color,box-shadow] duration-100',
                    targetStatesByStackKey?.[ship.stackKey]?.isTargetable && 'cursor-pointer'
                  )}
                  style={getDestroyTargetSurfaceStyle(targetStatesByStackKey?.[ship.stackKey])}
                  onMouseEnter={
                    targetStatesByStackKey?.[ship.stackKey]?.isTargetable
                      ? () => onDestroyTargetHoverChange?.(ship.stackKey)
                      : undefined
                  }
                  onMouseLeave={
                    targetStatesByStackKey?.[ship.stackKey]?.isTargetable
                      ? () => onDestroyTargetHoverChange?.(null)
                      : undefined
                  }
                  onMouseDown={(event) => {
                    event.stopPropagation();
                    if (targetStatesByStackKey?.[ship.stackKey]?.isTargetable) {
                      onDestroyTargetMouseDown?.(ship.stackKey);
                    }
                  }}
                >
                  <ShipStack 
                    ship={ship}
                    animToken={animTokens?.[ship.stackKey]}
                    side={side}
                    opponentEntryDelays={opponentEntryDelays}
                    activationIndexMap={activationIndexMap}
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-row flex-nowrap items-center justify-start gap-[30px]">
              {grouped.row2.map((ship) => (
                <div
                  key={ship.stackKey}
                  ref={getFlipRef(ship.stackKey)}
                  className={cx(
                    'rounded-[18px] border border-transparent px-[10px] py-[8px] transition-[background-color,border-color,box-shadow] duration-100',
                    targetStatesByStackKey?.[ship.stackKey]?.isTargetable && 'cursor-pointer'
                  )}
                  style={getDestroyTargetSurfaceStyle(targetStatesByStackKey?.[ship.stackKey])}
                  onMouseEnter={
                    targetStatesByStackKey?.[ship.stackKey]?.isTargetable
                      ? () => onDestroyTargetHoverChange?.(ship.stackKey)
                      : undefined
                  }
                  onMouseLeave={
                    targetStatesByStackKey?.[ship.stackKey]?.isTargetable
                      ? () => onDestroyTargetHoverChange?.(null)
                      : undefined
                  }
                  onMouseDown={(event) => {
                    event.stopPropagation();
                    if (targetStatesByStackKey?.[ship.stackKey]?.isTargetable) {
                      onDestroyTargetMouseDown?.(ship.stackKey);
                    }
                  }}
                >
                  <ShipStack 
                    ship={ship}
                    animToken={animTokens?.[ship.stackKey]}
                    side={side}
                    opponentEntryDelays={opponentEntryDelays}
                    activationIndexMap={activationIndexMap}
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-row flex-nowrap items-center justify-start gap-[30px]">
              {grouped.row3.map((ship) => (
                <div
                  key={ship.stackKey}
                  ref={getFlipRef(ship.stackKey)}
                  className={cx(
                    'rounded-[18px] border border-transparent px-[10px] py-[8px] transition-[background-color,border-color,box-shadow] duration-100',
                    targetStatesByStackKey?.[ship.stackKey]?.isTargetable && 'cursor-pointer'
                  )}
                  style={getDestroyTargetSurfaceStyle(targetStatesByStackKey?.[ship.stackKey])}
                  onMouseEnter={
                    targetStatesByStackKey?.[ship.stackKey]?.isTargetable
                      ? () => onDestroyTargetHoverChange?.(ship.stackKey)
                      : undefined
                  }
                  onMouseLeave={
                    targetStatesByStackKey?.[ship.stackKey]?.isTargetable
                      ? () => onDestroyTargetHoverChange?.(null)
                      : undefined
                  }
                  onMouseDown={(event) => {
                    event.stopPropagation();
                    if (targetStatesByStackKey?.[ship.stackKey]?.isTargetable) {
                      onDestroyTargetMouseDown?.(ship.stackKey);
                    }
                  }}
                >
                  <ShipStack 
                    ship={ship}
                    animToken={animTokens?.[ship.stackKey]}
                    side={side}
                    opponentEntryDelays={opponentEntryDelays}
                    activationIndexMap={activationIndexMap}
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-row flex-nowrap items-center justify-start gap-[30px]">
              {grouped.row4.map((ship) => (
                <div
                  key={ship.stackKey}
                  ref={getFlipRef(ship.stackKey)}
                  className={cx(
                    'rounded-[18px] border border-transparent px-[10px] py-[8px] transition-[background-color,border-color,box-shadow] duration-100',
                    targetStatesByStackKey?.[ship.stackKey]?.isTargetable && 'cursor-pointer'
                  )}
                  style={getDestroyTargetSurfaceStyle(targetStatesByStackKey?.[ship.stackKey])}
                  onMouseEnter={
                    targetStatesByStackKey?.[ship.stackKey]?.isTargetable
                      ? () => onDestroyTargetHoverChange?.(ship.stackKey)
                      : undefined
                  }
                  onMouseLeave={
                    targetStatesByStackKey?.[ship.stackKey]?.isTargetable
                      ? () => onDestroyTargetHoverChange?.(null)
                      : undefined
                  }
                  onMouseDown={(event) => {
                    event.stopPropagation();
                    if (targetStatesByStackKey?.[ship.stackKey]?.isTargetable) {
                      onDestroyTargetMouseDown?.(ship.stackKey);
                    }
                  }}
                >
                  <ShipStack 
                    ship={ship}
                    animToken={animTokens?.[ship.stackKey]}
                    side={side}
                    opponentEntryDelays={opponentEntryDelays}
                    activationIndexMap={activationIndexMap}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </FitToBox>
    </div>
  );
}

function Metric({
  value,
  label,
  label2,
  align = 'left',
  toneClass = 'text-white',
  className,
}: {
  value: string;
  label?: string;
  label2?: string;
  align?: 'left' | 'right';
  toneClass?: string;
  className?: string;
}) {
  const isRight = align === 'right';
  const hasLabel = Boolean(label || label2);

  return (
    <div
      className={cx(
        'content-stretch flex flex-col relative shrink-0',
        className,
        toneClass,
        isRight && 'items-end text-right'
      )}
    >
      <p
        className="font-['Roboto'] font-semibold leading-[36px] relative shrink-0 text-[36px] w-[50px]"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        {value}
      </p>

      {hasLabel ? (
        <p
          className={cx(
            "font-['Roboto'] font-normal leading-[normal] relative shrink-0 text-[11px] text-nowrap uppercase",
            isRight && 'text-right'
          )}
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {label}
          {label2 ? (
            <>
              <br aria-hidden="true" />
              {label2}
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

function StatTripletRow({
  left,
  centerLabel,
  right,
  toneClass,
  className,
}: {
  left: string;
  centerLabel: string;
  right: string;
  toneClass?: string;
  className?: string;
}) {
  return (
    <div className={cx('content-stretch flex gap-[10px] items-center justify-center relative shrink-0', className, toneClass)}>
      <p
        className="font-['Roboto'] font-semibold leading-[36px] relative shrink-0 text-[36px] text-right w-[80px]"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        {left}
      </p>
      <p
        className="font-['Roboto'] font-normal leading-[normal] relative shrink-0 text-[15px] text-center w-[64px]"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        {centerLabel}
      </p>
      <p
        className="font-['Roboto'] font-semibold leading-[36px] relative shrink-0 text-[36px] w-[80px]"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        {right}
      </p>
    </div>
  );
}

export function BoardStage({ vm, actions }: BoardStageProps) {
  const displayedMyHealth = useAnimatedHealth(vm.mode === 'board' ? vm.myHealth : 25);
  const displayedOpponentHealth = useAnimatedHealth(vm.mode === 'board' ? vm.opponentHealth : 25);

  // Choose species mode
  if (vm.mode === 'choose_species') {
    return (
      <ChooseSpeciesStage
        vm={vm}
        onSelectSpecies={actions.onSelectSpecies}
        onConfirmSpecies={actions.onConfirmSpecies}
        onCopyGameUrl={actions.onCopyGameUrl}
      />
    );
  }

  // Runtime guard: ensure species values are valid SpeciesKey
  function toSpeciesKey(raw: unknown): SpeciesKey {
    const s = String(raw ?? '').trim().toLowerCase();
    if (s === 'human' || s === 'xenite' || s === 'centaur' || s === 'ancient') return s;
    return 'human'; // Safe fallback
  }

  const mySpeciesKey = toSpeciesKey(vm.mySpeciesId);
  const opponentSpeciesKey = toSpeciesKey(vm.opponentSpeciesId);

  // Hide deltas on turn 1 only
  const showDeltas = vm.turnNumber > 1;
  const myDeltaKey = showDeltas ? `my:${vm.turnNumber}:${vm.myLastTurnNet}` : 'my:hidden';
  const opponentDeltaKey = showDeltas ? `opp:${vm.turnNumber}:${vm.opponentLastTurnNet}` : 'opp:hidden';

  // Board mode (existing placeholder layout)
  return (
    <div
      className="content-stretch flex gap-[8px] items-start justify-center px-0 py-[12px] relative size-full"
      data-name="Board Stage"
      onMouseDown={actions.onBoardBackgroundMouseDown}
    >
      <FleetArea 
        title="MY FLEET" 
        ships={vm.myFleet} 
        order={vm.myFleetOrder} 
        species={mySpeciesKey}
        animTokens={vm.fleetAnim.my}
        flipEnabled={vm.mode === 'board'}
        side="my"
        opponentEntryDelays={undefined}
        activationIndexMap={vm.activationStaggerPlan?.myIndexByShipId}
      />

      <div
        className="content-stretch flex flex-col h-full items-center justify-between relative shrink-0 w-[230px]"
        data-name="Health and Stats"
      >
        {/* Health */}
        <div
          className="content-stretch flex gap-[10px] items-start justify-center relative shrink-0 w-full"
          data-name="Health Wrapper"
        >
          <div
            className="content-stretch flex flex-col font-['Roboto'] font-bold gap-px items-end relative shrink-0 text-right w-[100px]"
            data-name="P1 Health Group"
          >
            <p
              className="leading-[64px] relative shrink-0 text-[64px] text-white w-full"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              {displayedMyHealth}
            </p>

            {/* Delta (server-authoritative) */}
            <p
              className="font-['Roboto'] font-semibold leading-[28px] relative shrink-0 text-[28px] w-full text-right"
              style={{
                fontVariationSettings: "'wdth' 100",
                color: vm.myLastTurnNet > 0 
                  ? 'var(--shapeships-pastel-green)' 
                  : vm.myLastTurnNet < 0 
                  ? 'var(--shapeships-pastel-red)' 
                  : 'var(--shapeships-grey-50)',
                opacity: showDeltas ? 1 : 0,
                pointerEvents: showDeltas ? 'auto' : 'none',
              }}
            >
              <span key={myDeltaKey} className={showDeltas ? 'ss-health-delta-pop-in' : undefined}>
                {showDeltas ? (vm.myLastTurnNet > 0 ? `+${vm.myLastTurnNet}` : vm.myLastTurnNet === 0 ? '±0' : vm.myLastTurnNet) : ''}
              </span>
            </p>
          </div>

          <div
            className="content-stretch flex items-center justify-center pb-0 pt-[22px] px-0 relative shrink-0"
            data-name="Health Label"
          >
            <div className="flex flex-col items-center justify-start w-[64px] text-center">
              <p
                className="font-['Roboto'] font-normal leading-[1.25] relative shrink-0 text-white text-[15px]"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Health
              </p>

              {/* Max Health (UI placeholder) */}
              <p
                className="font-['Roboto'] font-semibold leading-[13px] relative shrink-0 text-[13px]"
                style={{
                  fontVariationSettings: "'wdth' 100",
                  color: 'rgba(255,255,255,0.45)',
                }}
              >
                35
              </p>
            </div>
          </div>

          <div
            className="content-stretch flex flex-col font-['Roboto'] font-bold items-start relative shrink-0 w-[100px]"
            data-name="P2 Health Group"
          >
            <p
              className="leading-[64px] relative shrink-0 text-[64px] text-white w-[100px] text-left"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              {displayedOpponentHealth}
            </p>

            {/* Delta (server-authoritative) */}
            <p
              className="font-['Roboto'] font-semibold leading-[28px] relative shrink-0 text-[28px] w-[100px] text-left"
              style={{
                fontVariationSettings: "'wdth' 100",
                color: vm.opponentLastTurnNet > 0 
                  ? 'var(--shapeships-pastel-green)' 
                  : vm.opponentLastTurnNet < 0 
                  ? 'var(--shapeships-pastel-red)' 
                  : 'var(--shapeships-grey-50)',
                opacity: showDeltas ? 1 : 0,
                pointerEvents: showDeltas ? 'auto' : 'none',
              }}
            >
              <span key={opponentDeltaKey} className={showDeltas ? 'ss-health-delta-pop-in' : undefined}>
                {showDeltas ? (vm.opponentLastTurnNet > 0 ? `+${vm.opponentLastTurnNet}` : vm.opponentLastTurnNet === 0 ? '±0' : vm.opponentLastTurnNet) : ''}
              </span>
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="content-stretch flex flex-col gap-[20px] items-center relative shrink-0 w-full" data-name="Stats Wrapper">
          {/* Saved Lines */}
          <div className="content-stretch flex gap-[10px] items-start justify-center relative shrink-0 w-full" data-name="Saved Lines Group">
            {/* P1 */}
            <div className="content-stretch flex items-start justify-end relative shrink-0 w-[100px]" data-name="P1 Saved Wrapper">
              <div className="content-stretch flex items-start relative shrink-0">
                <Metric value="0" align="right" toneClass="text-white" />
                {/* Joining lines, will turn on if player has saved joining lines */}
                {/* <Metric value="0" label="JOINING" align="right" toneClass="text-white" /> */}
              </div>
            </div>
          
            <p
              className="font-['Roboto'] font-normal leading-[normal] relative shrink-0 text-[15px] text-center text-white w-[64px]"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              Saved
              <br aria-hidden="true" />
              Lines
            </p>
          
            {/* P2 */}
            <div className="content-stretch flex items-start relative shrink-0 w-[100px]" data-name="P2 Saved Wrapper">
              <div className="content-stretch flex items-start relative shrink-0">
                <Metric value="0" align="left" toneClass="text-white" />
                {/* Joining lines, will turn on if player has saved joining lines */}
                {/* <Metric value="0" label="JOINING" align="left" toneClass="text-white" /> */}
              </div>
            </div>
          </div>

          <StatTripletRow
            left={String(vm.myLastTurnDamage ?? 0)}
            centerLabel="Damage"
            right={String(vm.opponentLastTurnDamage ?? 0)}
            toneClass="text-[#ff8282]"
          />
          <StatTripletRow
            left={String(vm.myLastTurnHeal ?? 0)}
            centerLabel="Healing"
            right={String(vm.opponentLastTurnHeal ?? 0)}
            toneClass="text-[#9cff84]"
          />

          {/* Bonus */}
          <div className="content-stretch flex gap-[10px] items-start justify-center relative shrink-0 w-full" data-name="Bonus Group">
            <div className="content-stretch flex gap-[4px] items-center justify-end relative shrink-0 w-[100px]" data-name="P1 Bonuses">
              {/* TODO (Centaur pass): show secondary label like "on EVEN" only for Centaur bonus-line rules */}
              <Metric value={String(vm.myBonusLines ?? 0)} label="Lines" align="right" toneClass="text-[#62fff6]" />
              {/* Joining lines, will turn on if player has bonus joining lines */}
              {/* <Metric value="0" label="JOINING" label2="LINES" align="right" toneClass="text-[#62fff6]" /> */}
            </div>

            <div className="content-stretch flex items-center justify-center pb-0 pt-[8px] px-0 relative shrink-0">
              <p
                className="font-['Roboto'] font-normal leading-[normal] relative shrink-0 text-[#62fff6] text-[15px] text-center w-[64px]"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Bonus
              </p>
            </div>

            <div className="content-stretch flex gap-[4px] items-start relative shrink-0 w-[100px]" data-name="P2 Bonuses">
              <Metric value={String(vm.opponentBonusLines ?? 0)} label="Lines" align="left" toneClass="text-[#62fff6]" />
              {/* Joining lines, will turn on if player has bonus joining lines */}
              {/* <Metric value="0" label="JOINING" label2="LINES" align="left" toneClass="text-[#62fff6]" /> */}
            </div>
          </div>
        </div>
      </div>

      <FleetArea 
        title="OPPONENT FLEET" 
        ships={vm.opponentFleet} 
        order={vm.opponentFleetOrder} 
        species={opponentSpeciesKey}
        animTokens={vm.fleetAnim.opponent}
        flipEnabled={vm.mode === 'board'}
        side="opponent"
        opponentEntryDelays={vm.opponentFleetEntryPlan?.opponent}
        activationIndexMap={vm.activationStaggerPlan?.opponentIndexByShipId}
        targetStatesByStackKey={vm.destroyTargeting?.targetStatesByStackKey}
        onDestroyTargetHoverChange={actions.onDestroyTargetStackHoverChange}
        onDestroyTargetMouseDown={actions.onDestroyTargetStackMouseDown}
      />
    </div>
  );
}
