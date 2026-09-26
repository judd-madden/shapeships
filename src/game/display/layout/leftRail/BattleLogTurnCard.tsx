import { Dice } from '../../../../components/ui/primitives';
import type {
  BattleLogThisTurnVm,
  BattleLogTurnSideVm,
  BattleLogTurnVm,
} from '../../../client/gameSession/types';
import { BattleLogLine } from './BattleLogLine';

interface BattleLogTurnCardProps {
  turn: BattleLogTurnVm;
}

interface BattleLogThisTurnCardProps {
  turn: BattleLogThisTurnVm;
}

type BattleLogSectionSide = Pick<BattleLogTurnSideVm, 'battleLines' | 'buildLines'>;

function formatDelta(delta: number): string {
  if (delta > 0) {
    return `+${delta}`;
  }

  if (delta < 0) {
    return String(delta);
  }

  return '±0';
}

function getDeltaColor(delta: number): string {
  if (delta > 0) {
    return 'var(--shapeships-pastel-green)';
  }

  if (delta < 0) {
    return 'var(--shapeships-pastel-red)';
  }

  return 'var(--shapeships-grey-50)';
}

function SectionDivider({ live = false }: { live?: boolean }) {
  const dividerStyle = live
    ? { backgroundColor: 'var(--shapeships-grey-70)', opacity: 0.5 }
    : { backgroundColor: 'var(--shapeships-grey-90)' };

  return (
    <div className="flex items-center gap-[6px]">
      <div className="h-px flex-1" style={dividerStyle} />
      <p aria-hidden="true" className="text-[12px] font-medium text-[var(--shapeships-grey-50)]" />
      <div className="h-px flex-1" style={dividerStyle} />
    </div>
  );
}

function BattleLogSections({
  turnNumber,
  showBattleSection,
  showBuildSection,
  me,
  opponent,
  live = false,
}: {
  turnNumber: number;
  showBattleSection: boolean;
  showBuildSection: boolean;
  me: BattleLogSectionSide;
  opponent: BattleLogSectionSide;
  live?: boolean;
}) {
  const keyPrefix = live ? 'this-turn' : `turn-${turnNumber}`;

  return (
    <>
      {showBattleSection ? (
        <div className="flex flex-col gap-[4px]">
          {!live ? <SectionDivider /> : null}
          <div className="grid grid-cols-2 gap-[16px]">
            <div className="flex flex-col">
              {me.battleLines.map((line, index) => (
                <BattleLogLine key={`${keyPrefix}-me-battle-${index}`} line={line} align="left" />
              ))}
            </div>
            <div className="flex flex-col">
              {opponent.battleLines.map((line, index) => (
                <BattleLogLine key={`${keyPrefix}-op-battle-${index}`} line={line} align="right" />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {showBuildSection ? (
        <div className="flex flex-col gap-[4px]">
          {!live || showBattleSection ? <SectionDivider live={live} /> : null}
          <div className="grid grid-cols-2 gap-[12px]">
            <div className="flex flex-col">
              {me.buildLines.map((line, index) => (
                <BattleLogLine key={`${keyPrefix}-me-build-${index}`} line={line} align="left" />
              ))}
            </div>
            <div className="flex flex-col">
              {opponent.buildLines.map((line, index) => (
                <BattleLogLine key={`${keyPrefix}-op-build-${index}`} line={line} align="right" />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function BattleLogThisTurnCard({ turn }: BattleLogThisTurnCardProps) {
  return (
    <div className="w-full px-[20px] py-[12px] flex flex-col gap-[8px] bg-[var(--shapeships-grey-90)]">
      <div className="flex items-center gap-[6px]">
        <div className="h-px flex-1 bg-[var(--shapeships-grey-70)] opacity-50" />
        <p className="text-[15px] italic font-black text-[var(--shapeships-grey-20)]">
          This Turn
        </p>
        <div className="h-px flex-1 bg-[var(--shapeships-grey-70)] opacity-50" />
      </div>

      <BattleLogSections
        turnNumber={turn.turnNumber}
        showBattleSection={turn.showBattleSection}
        showBuildSection={turn.showBuildSection}
        me={turn.me}
        opponent={turn.opponent}
        live
      />
    </div>
  );
}

export function BattleLogTurnCard({ turn }: BattleLogTurnCardProps) {
  const backgroundColor = turn.turnNumber % 2 === 1 ? '#171717' : 'black';

  return (
    <div className="w-full px-[20px] py-[12px] flex flex-col gap-[8px]" style={{ backgroundColor }}>
      <div className="grid grid-cols-[50px_1fr_50px] items-center gap-[12px]">
        <div className="w-[50px] flex items-center justify-start gap-[4px] overflow-visible whitespace-nowrap text-left">
          <p className="text-[15px] font-bold text-[var(--shapeships-grey-20)]">{turn.me.healthEnd}</p>
          <p className="text-[15px] font-bold" style={{ color: getDeltaColor(turn.me.healthDelta) }}>
            {formatDelta(turn.me.healthDelta)}
          </p>
        </div>

        <div className="flex items-center justify-center gap-[8px]">
          {typeof turn.diceValue === 'number' ? (
            <Dice
              value={turn.diceValue as 1 | 2 | 3 | 4 | 5 | 6}
              className="!size-[36px] shrink-0"
              enableRotate={false}
            />
          ) : (
            <div aria-hidden="true" className="size-[36px]" />
          )}
          <p className="text-[15px] italic font-black text-[var(--shapeships-grey-20)]">
            Turn {turn.turnNumber}
          </p>
        </div>

        <div className="w-[50px] flex items-center justify-end gap-[4px] overflow-visible whitespace-nowrap text-right">
          <p className="text-[15px] font-bold text-[var(--shapeships-grey-20)]">{turn.opponent.healthEnd}</p>
          <p
            className="text-[15px] font-bold"
            style={{ color: getDeltaColor(turn.opponent.healthDelta) }}
          >
            {formatDelta(turn.opponent.healthDelta)}
          </p>
        </div>
      </div>

      <BattleLogSections
        turnNumber={turn.turnNumber}
        showBattleSection={turn.showBattleSection}
        showBuildSection={turn.showBuildSection}
        me={turn.me}
        opponent={turn.opponent}
      />
    </div>
  );
}
