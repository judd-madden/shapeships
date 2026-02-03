/**
 * Board Stage
 * Main game board with 3 columns: P1 Fleet | Health/Stats | P2 Fleet
 * NO LOGIC - displays view-model data only (Pass 1.25)
 */

import type { BoardViewModel, GameSessionActions } from '../../client/useGameSession';
import { ChooseSpeciesStage } from './boardModes/ChooseSpeciesStage';
import { getShipDefinitionUI } from '../../data/ShipDefinitionsUI';
import type { ShipDefId } from '../../types/ShipTypes.engine';
import { FitToBox } from './FitToBox';

interface BoardStageProps {
  vm: BoardViewModel;
  actions: GameSessionActions;
}

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ');
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
  3: new Set<ShipDefId>(['EQU', 'WIS', 'FAM']),
  4: new Set<ShipDefId>(['DES', 'DOM']),
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

function sortByPersistentOrder(
  ships: Array<{ shipDefId: string; count: number }>,
  order?: string[]
) {
  const index = new Map<string, number>();
  (order ?? []).forEach((id, i) => index.set(id, i));

  return [...ships].sort((a, b) => {
    const ai = index.has(a.shipDefId) ? index.get(a.shipDefId)! : Number.POSITIVE_INFINITY;
    const bi = index.has(b.shipDefId) ? index.get(b.shipDefId)! : Number.POSITIVE_INFINITY;
    if (ai !== bi) return ai - bi;
    return a.shipDefId.localeCompare(b.shipDefId);
  });
}

function groupShipsIntoRows(
  ships: Array<{ shipDefId: string; count: number }>,
  order: string[] | undefined,
  rowSets: RowSets
) {
  const sorted = sortByPersistentOrder(ships, order);

  const row1: typeof sorted = [];
  const row2: typeof sorted = [];
  const row3: typeof sorted = [];
  const row4: typeof sorted = [];

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

function ShipStack({ ship }: { ship: { shipDefId: string; count: number } }) {
  const def = getShipDefinitionUI(ship.shipDefId as ShipDefId);
  const ShipGraphic = def?.graphics?.[0]?.component;
  const numberColour = toCssVarFromColourName(def?.colour);

  return (
    <div className="flex flex-row items-center gap-[8px]">
      <div className="flex items-center justify-center">
        {ShipGraphic ? <ShipGraphic /> : <span className="text-white text-sm">{ship.shipDefId}</span>}
      </div>

      {ship.count > 1 ? (
        <div
          className="font-['Roboto'] font-semibold"
          style={{
            fontSize: '50px',
            lineHeight: 1,
            fontVariationSettings: "'wdth' 100",
            color: numberColour ?? 'white',
          }}
        >
          {ship.count}
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
}: {
  title: string;
  ships?: Array<{ shipDefId: string; count: number }>;
  order?: string[];
  species: SpeciesKey;
}) {
  const rowSets = ROW_SETS_BY_SPECIES[species];
  const grouped = ships && ships.length > 0 ? groupShipsIntoRows(ships, order, rowSets) : null;

  return (
    <div className="basis-0 bg-[rgba(255,255,255,0.05)] grow h-full min-h-px min-w-px relative shrink-0 pl-[12px]">
      {/* FleetArea: {title} (title intentionally not rendered) */}
      <FitToBox minScale={0.4} className="w-full h-full">
        {grouped ? (
          <div className="flex flex-col items-center gap-[18px]">
            <div className="flex flex-row flex-nowrap items-center justify-start gap-[30px]">
              {grouped.row1.map((ship) => (
                <ShipStack key={ship.shipDefId} ship={ship} />
              ))}
            </div>

            <div className="flex flex-row flex-nowrap items-center justify-start gap-[30px]">
              {grouped.row2.map((ship) => (
                <ShipStack key={ship.shipDefId} ship={ship} />
              ))}
            </div>

            <div className="flex flex-row flex-nowrap items-center justify-start gap-[30px]">
              {grouped.row3.map((ship) => (
                <ShipStack key={ship.shipDefId} ship={ship} />
              ))}
            </div>

            <div className="flex flex-row flex-nowrap items-center justify-start gap-[30px]">
              {grouped.row4.map((ship) => (
                <ShipStack key={ship.shipDefId} ship={ship} />
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

  // Board mode (existing placeholder layout)
  return (
    <div
      className="content-stretch flex gap-[8px] items-start justify-center px-0 py-[12px] relative size-full"
      data-name="Board Stage"
    >
      <FleetArea title="MY FLEET" ships={vm.myFleet} order={vm.myFleetOrder} species={mySpeciesKey} />

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
            <p className="leading-[64px] relative shrink-0 text-[64px] text-white w-full" style={{ fontVariationSettings: "'wdth' 100" }}>
              {vm.myHealth}
            </p>
          </div>

          <div className="content-stretch flex items-center justify-center pb-0 pt-[22px] px-0 relative shrink-0" data-name="Health Label">
            <p
              className="font-['Roboto'] font-normal leading-[1.25] relative shrink-0 text-[0px] text-center text-white w-[64px]"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              <span className="text-[15px]">
                Health
                <br aria-hidden="true" />
              </span>
            </p>
          </div>

          <div className="content-stretch flex flex-col font-['Roboto'] font-bold items-start relative shrink-0" data-name="P2 Health Group">
            <p className="leading-[64px] relative shrink-0 text-[64px] text-white w-[100px]" style={{ fontVariationSettings: "'wdth' 100" }}>
              {vm.opponentHealth}
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
                <Metric value="99" align="right" toneClass="text-white" />
                <Metric value="99" label="JOINING" align="right" toneClass="text-white" />
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
                <Metric value="99" align="left" toneClass="text-white" />
                <Metric value="99" label="JOINING" align="left" toneClass="text-white" />
              </div>
            </div>
          </div>

          <StatTripletRow left="999" centerLabel="Damage" right="999" toneClass="text-[#ff8282]" />
          <StatTripletRow left="999" centerLabel="Healing" right="999" toneClass="text-[#9cff84]" />

          {/* Bonus */}
          <div className="content-stretch flex gap-[10px] items-start justify-center relative shrink-0 w-full" data-name="Bonus Group">
            <div className="content-stretch flex gap-[4px] items-center justify-end relative shrink-0 w-[100px]" data-name="P1 Bonuses">
              <Metric value="99" label="Lines" label2="on EVEN" align="right" toneClass="text-[#62fff6]" />
              <Metric value="99" label="JOINING" label2="LINES" align="right" toneClass="text-[#62fff6]" />
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
              <Metric value="99" label="Lines" align="left" toneClass="text-[#62fff6]" />
              <Metric value="99" label="JOINING" label2="LINES" align="left" toneClass="text-[#62fff6]" />
            </div>
          </div>
        </div>
      </div>

      <FleetArea title="OPPONENT FLEET" ships={vm.opponentFleet} order={vm.opponentFleetOrder} species={opponentSpeciesKey} />
    </div>
  );
}