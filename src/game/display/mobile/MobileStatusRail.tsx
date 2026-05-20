import { Dice } from '../../../components/ui/primitives';
import type {
  BoardViewModel,
  HudStatusTone,
  HudViewModel,
  LeftRailViewModel,
} from '../../client/useGameSession';

type MobileBoardViewModel = Extract<BoardViewModel, { mode: 'board' }>;
type MobileRowPosition = 'top' | 'bottom';

interface MobileStatusRailProps {
  hudVm: HudViewModel;
  boardVm: MobileBoardViewModel;
  leftRailVm: LeftRailViewModel;
}

interface MobilePlayerStatusRowData {
  name: string;
  statusText: string;
  statusTone: HudStatusTone;
  isOnline: boolean;
  health: number;
  netDelta: number;
  healing: number;
  damage: number;
  bonus: number;
  joiningBonus: number;
  savedLines: number;
  savedJoiningLines: number;
}

export function MobileStatusRail({ hudVm, boardVm, leftRailVm }: MobileStatusRailProps) {
  const opponentStatus: MobilePlayerStatusRowData = {
    name: hudVm.p2Name,
    statusText: hudVm.p2StatusText ?? '',
    statusTone: hudVm.p2StatusTone,
    isOnline: hudVm.p2IsOnline,
    health: boardVm.opponentHealth,
    netDelta: boardVm.opponentLastTurnNet,
    healing: boardVm.opponentLastTurnHeal,
    damage: boardVm.opponentLastTurnDamage,
    bonus: boardVm.opponentBonusLines,
    joiningBonus: boardVm.opponentJoiningBonusLines,
    savedLines: boardVm.opponentDisplayedSavedLines,
    savedJoiningLines: boardVm.opponentDisplayedSavedJoiningLines,
  };

  const currentPlayerStatus: MobilePlayerStatusRowData = {
    name: hudVm.p1Name,
    statusText: hudVm.p1StatusText ?? '',
    statusTone: hudVm.p1StatusTone,
    isOnline: hudVm.p1IsOnline,
    health: boardVm.myHealth,
    netDelta: boardVm.myLastTurnNet,
    healing: boardVm.myLastTurnHeal,
    damage: boardVm.myLastTurnDamage,
    bonus: boardVm.myBonusLines,
    joiningBonus: boardVm.myJoiningBonusLines,
    savedLines: boardVm.myDisplayedSavedLines,
    savedJoiningLines: boardVm.myDisplayedSavedJoiningLines,
  };

  return (
    <div className="shrink-0 w-full py-[8px]">
      <div className="flex items-stretch gap-[12px] px-[14px] w-full">
        <div className="flex-1 min-w-0 flex flex-col gap-[6px]">
          <MobilePlayerStatusRow row={opponentStatus} position="top" />
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white to-transparent opacity-70" />
          <MobilePlayerStatusRow row={currentPlayerStatus} position="bottom" />
        </div>

        <div className="shrink-0 w-[56px] flex flex-col items-center justify-between py-[1px]">
          <span className="w-[56px] truncate text-center text-[15px] font-bold leading-4 text-[var(--shapeships-grey-50)]">
            {hudVm.p2Clock}
          </span>
          <Dice
            value={leftRailVm.diceValue}
            animateKey={leftRailVm.diceAnimateKey}
            className="w-[52px] h-[52px]"
            enableRotate={false}
          />
          <span className="w-[56px] truncate text-center text-[15px] font-bold leading-4 text-white">
            {hudVm.p1Clock}
          </span>
        </div>
      </div>
    </div>
  );
}

function MobilePlayerStatusRow({
  row,
  position,
}: {
  row: MobilePlayerStatusRowData;
  position: MobileRowPosition;
}) {
  return (
    <div className={position === 'top' ? 'flex items-end w-full' : 'flex items-start w-full'}>
      <div className="flex-1 min-w-0 flex items-center justify-between gap-[6px]">
        <div className="flex flex-1 min-w-0 items-center gap-[5px]">
          <div className="flex w-[38px] shrink-0 flex-col items-center text-center font-bold whitespace-nowrap">
            <span className="text-[26px] leading-[26px] text-white">{row.health}</span>
            <span className={`text-[15px] leading-[16px] ${getNetDeltaClassName(row.netDelta)}`}>
              {formatNetDelta(row.netDelta)}
            </span>
          </div>

          <div className="flex flex-1 min-w-0 flex-col gap-[1px]">
            <div className="flex h-[19px] w-full min-w-0 items-center gap-[4px]">
              <OnlineDot isOnline={row.isOnline} />
              <span className="min-w-0 flex-1 truncate text-[15px] leading-[19px] text-white">
                {row.name}
              </span>
            </div>
            <div className="flex h-[16px] items-center pl-[11px]">
              <span className={`truncate text-[12px] font-bold leading-4 ${getStatusClassName(row.statusTone)}`}>
                {row.statusText || <span aria-hidden="true">&nbsp;</span>}
              </span>
            </div>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-[28px_28px_24px_24px] items-start gap-[3px] text-center font-bold whitespace-nowrap">
          <span className="text-[15px] text-[var(--shapeships-pastel-green)]">
            {row.healing}
          </span>
          <span className="text-[15px] text-[var(--shapeships-pastel-red)]">
            {row.damage}
          </span>
          <MobileStackedStat
            value={row.bonus}
            joiningValue={row.joiningBonus}
            toneClassName="text-[var(--shapeships-pastel-blue)]"
          />
          <MobileStackedStat
            value={row.savedLines}
            joiningValue={row.savedJoiningLines}
            toneClassName="text-white"
          />
        </div>
      </div>
    </div>
  );
}

function MobileStackedStat({
  value,
  joiningValue,
  toneClassName,
}: {
  value: number;
  joiningValue: number;
  toneClassName: string;
}) {
  return (
    <span className={`flex flex-col items-center justify-end ${toneClassName}`}>
      <span className="text-[15px]">{value}</span>
      <span className="text-[10px] leading-[10px]">{joiningValue > 0 ? `${joiningValue}j` : ''}</span>
    </span>
  );
}

function OnlineDot({ isOnline }: { isOnline: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-[7px] shrink-0 rounded-full ${
        isOnline ? 'bg-[var(--shapeships-green)]' : 'bg-[var(--shapeships-grey-50)]'
      }`}
    />
  );
}

function formatNetDelta(value: number): string {
  if (value > 0) {
    return `+${value}`;
  }

  return String(value);
}

function getNetDeltaClassName(value: number): string {
  if (value > 0) {
    return 'text-[var(--shapeships-pastel-green)]';
  }

  if (value < 0) {
    return 'text-[var(--shapeships-pastel-red)]';
  }

  return 'text-[var(--shapeships-grey-50)]';
}

function getStatusClassName(tone: HudStatusTone): string {
  if (tone === 'ready') {
    return 'text-[var(--shapeships-pastel-green)]';
  }

  if (tone === 'hidden') {
    return 'text-transparent';
  }

  return 'text-white';
}
