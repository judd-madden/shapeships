/**
 * Board Stage
 * Main game board with 3 columns: P1 Fleet | Health/Stats | P2 Fleet
 * NO LOGIC - displays view-model data only (Pass 1.25)
 */

import type { BoardViewModel, GameSessionActions } from '../../client/useGameSession';
import { ChooseSpeciesStage } from './boardModes/ChooseSpeciesStage';

interface BoardStageProps {
  vm: BoardViewModel;
  actions: GameSessionActions;
}

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ');
}

function FleetPlaceholder({ title, ships }: { title: string; ships?: Array<{ shipDefId: string; count: number }> }) {
  return (
    <div className="basis-0 bg-[rgba(255,255,255,0.05)] grow h-full min-h-px min-w-px relative shrink-0">
      <div className="flex flex-row items-center justify-center size-full">
        <div className="content-stretch flex flex-col items-center justify-center px-[225px] py-[186px] relative size-full gap-2">
          <p
            className="font-['Roboto'] font-normal leading-[normal] relative shrink-0 text-[21.6px] text-nowrap text-white"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {title}
          </p>
          {ships && ships.length > 0 && (
            <div className="flex flex-col gap-1 text-white text-sm">
              {ships.map(ship => (
                <div key={ship.shipDefId}>
                  {ship.shipDefId} × {ship.count}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
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

  // Board mode (existing placeholder layout)
  return (
    <div
      className="content-stretch flex gap-[8px] items-start justify-center px-0 py-[12px] relative size-full"
      data-name="Board Stage"
    >
      <FleetPlaceholder title="MY FLEET" ships={vm.myFleet} />

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

      <FleetPlaceholder title="OPPONENT FLEET" ships={vm.opponentFleet} />
    </div>
  );
}