/**
 * Menu Action Panel
 * Shown when vm.activePanelId === 'ap.menu.root'
 * Displays in-progress game menu with draw offer and resign options
 *
 * NEW: Turn Flow widget (static phase list + current-phase dot)
 */

import { GameMenuButton } from '../../../../components/ui/primitives/buttons/GameMenuButton';
import { BuildIcon } from '../../../../components/ui/primitives/icons/BuildIcon';
import { BattleIcon } from '../../../../components/ui/primitives/icons/BattleIcon';

interface MenuActionPanelProps {
  title: string;     // "Shapeships Game: {me} v {opponent}"
  subtitle: string;  // "In Progress. Turn {n}."
  turnNumber: number;
  phaseKey: string;
  hasActionsForMe: boolean;
  onOfferDraw: () => void;
  onResignGame: () => void;
}

type PhaseRow = {
  key: string;
  label: string;
  group: 'build' | 'battle';
};

const PHASE_ROWS: PhaseRow[] = [
  { key: 'build.dice_roll', label: '1 Dice Roll & Dice Manipulation', group: 'build' },
  { key: 'build.line_generation', label: '2 Line Generation', group: 'build' },
  { key: 'build.ships_that_build', label: '3 Ships That Build', group: 'build' },
  { key: 'build.drawing', label: '4 Drawing', group: 'build' },
  { key: 'build.end_of_build', label: '5 End of Build Phase', group: 'build' },

  { key: 'battle.first_strike', label: '6 First Strike', group: 'battle' },
  { key: 'battle.charge_declaration', label: '7 Charge Declaration', group: 'battle' },
  { key: 'battle.charge_response', label: '8 Charge Response', group: 'battle' },
  { key: 'battle.end_of_turn_resolution', label: '9 End of Turn Resolution', group: 'battle' },
];

function TurnFlowWidget({
  turnNumber,
  phaseKey,
  hasActionsForMe,
}: {
  turnNumber: number;
  phaseKey: string;
  hasActionsForMe: boolean;
}) {
  const buildRows = PHASE_ROWS.filter(r => r.group === 'build');
  const battleRows = PHASE_ROWS.filter(r => r.group === 'battle');

    const isDrawingPhase = phaseKey === 'build.drawing';

    const dotColor =
        isDrawingPhase || hasActionsForMe
            ? 'var(--shapeships-green)'
            : 'var(--shapeships-grey-50)';

    const renderRow = (row: PhaseRow) => {
        const isCurrent = row.key === phaseKey;

        return (
            <div key={row.key} className="flex items-center gap-[6px]" style={{ lineHeight: '20px' }}>
                {/* Dot gutter (always takes space) */}
                <span style={{ display: 'inline-flex', width: 10, height: 10, alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                    {isCurrent ? (
                        <span
                            style={{
                                display: 'inline-block',
                                width: 10,
                                height: 10,
                                borderRadius: 9999,
                                backgroundColor: dotColor,
                            }}
                        />
                    ) : null}
                </span>

                <span
                    className="text-[14px] font-normal leading-[20px]"
                    style={{
                        fontVariationSettings: "'wdth' 100",
                        color: isCurrent ? 'white' : 'var(--shapeships-grey-50)',
                    }}
                >
                    {row.label}
                </span>
            </div>
        );
    };

  return (
    <div
      className="flex items-start gap-[30px] rounded-[10px] shrink-0"
      style={{
        padding: '30px 40px 30px 30px',
        background: 'rgba(33, 33, 33, 0.5)',
      }}
    >
      {/* Turn badge */}
      <div
        className="flex items-center justify-center rounded-[10px]"
        style={{
          padding: '10px 20px',
          background: 'var(--shapeships-grey-90)',
        }}
      >
        <span
          className="text-[30px] font-bold leading-[normal] text-white"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          Turn {turnNumber}
        </span>
      </div>

      {/* Phase columns */}
       <div className="flex w-full" style={{ gap: 20 }}>
        {/* Build */}
        <div className="flex flex-col" style={{ gap: '4px' }}>
          <div className="flex items-center gap-[10px] mb-[4px]">
            <span
              className="text-[18px] font-bold text-white"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              BUILD PHASE
            </span>
            <BuildIcon className="size-[26px]" color="#FFFFFF" />
          </div>
          <div className="flex flex-col" style={{ gap: '4px' }}>
            {buildRows.map(renderRow)}
          </div>
        </div>

        {/* Battle */}
        <div className="flex flex-col" style={{ gap: '4px' }}>
          <div className="flex items-center gap-[10px] mb-[4px]">
            <span
              className="text-[18px] font-bold text-white"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              BATTLE PHASE
            </span>
            <BattleIcon className="size-[26px]" color="#FFFFFF" />
          </div>
          <div className="flex flex-col" style={{ gap: '4px' }}>
            {battleRows.map(renderRow)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MenuActionPanel({
  title,
  subtitle,
  turnNumber,
  phaseKey,
  hasActionsForMe,
  onOfferDraw,
  onResignGame,
}: MenuActionPanelProps) {
  return (
      <div className="flex items-center justify-center relative w-full h-full">
        <div className="flex items-center justify-center w-full" style={{ gap: 40 }}>
        {/* Left: Turn flow */}
        <TurnFlowWidget turnNumber={turnNumber} phaseKey={phaseKey} hasActionsForMe={hasActionsForMe} />

        {/* Right: Existing menu block */}
        <div className="content-stretch flex flex-col gap-[20px] items-center relative shrink-0">
          {/* Title */}
          <p
            className="font-bold leading-[normal] relative shrink-0 text-[24px] text-center text-white"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {title}
          </p>

          {/* Subtitle */}
          <p
            className="font-bold leading-[normal] relative shrink-0 text-[16px] text-center text-white"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {subtitle}
          </p>

          {/* Buttons */}
          <div className="content-stretch flex gap-[20px] items-center justify-center pt-[8px] relative shrink-0 w-full">
            <GameMenuButton
              requiresConfirm={true}
              confirmLabel="Offer Draw (Confirm)"
              onClick={onOfferDraw}
            >
              Offer Draw
            </GameMenuButton>

            <GameMenuButton
              requiresConfirm={true}
              confirmLabel="Resign Game (Confirm)"
              onClick={onResignGame}
            >
              Resign Game
            </GameMenuButton>
          </div>
        </div>
      </div>
    </div>
  );
}
