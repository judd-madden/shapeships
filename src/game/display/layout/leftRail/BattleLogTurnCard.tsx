import { Dice } from '../../../../components/ui/primitives';
import type { BattleLogTurnVm } from '../../../client/gameSession/types';
import { BattleLogLine } from './BattleLogLine';

interface BattleLogTurnCardProps {
  turn: BattleLogTurnVm;
}

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

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-[6px]">
      <div className="h-px flex-1 bg-[var(--shapeships-grey-90)]" />
      <p className="text-[12px] font-medium text-[var(--shapeships-grey-50)]">{label}</p>
      <div className="h-px flex-1 bg-[var(--shapeships-grey-90)]" />
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

      {turn.showBuildSection ? (
        <div className="flex flex-col gap-[4px]">
          <SectionHeader label="BUILD" />
          <div className="grid grid-cols-2 gap-[12px]">
            <div className="flex flex-col">
              {turn.me.buildLines.map((line, index) => (
                <BattleLogLine key={`me-build-${turn.turnNumber}-${index}`} line={line} align="left" />
              ))}
            </div>
            <div className="flex flex-col">
              {turn.opponent.buildLines.map((line, index) => (
                <BattleLogLine key={`op-build-${turn.turnNumber}-${index}`} line={line} align="right" />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {turn.showBattleSection ? (
        <div className="flex flex-col gap-[4px]">
          <SectionHeader label="BATTLE" />
          <div className="grid grid-cols-2 gap-[12px]">
            <div className="flex flex-col">
              {turn.me.battleLines.map((line, index) => (
                <BattleLogLine key={`me-battle-${turn.turnNumber}-${index}`} line={line} align="left" />
              ))}
            </div>
            <div className="flex flex-col">
              {turn.opponent.battleLines.map((line, index) => (
                <BattleLogLine key={`op-battle-${turn.turnNumber}-${index}`} line={line} align="right" />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
