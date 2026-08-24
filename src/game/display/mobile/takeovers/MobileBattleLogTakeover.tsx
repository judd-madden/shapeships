import type { LeftRailViewModel } from '../../../client/useGameSession';
import { InChatButton } from '../../../../components/ui/primitives';
import { BattleLogPanelContent } from '../../shared/BattleLogPanelContent';
import { MobileTakeoverShell } from './MobileTakeoverShell';

interface MobileBattleLogTakeoverProps {
  vm: LeftRailViewModel;
  isGameFinished: boolean;
  onDownloadBattleLog: () => void;
  onClose: () => void;
}

export function MobileBattleLogTakeover({
  vm,
  isGameFinished,
  onDownloadBattleLog,
  onClose,
}: MobileBattleLogTakeoverProps) {
  return (
    <MobileTakeoverShell
      title="Battle Log"
      onClose={onClose}
      rightHeaderContent={
        isGameFinished ? (
          <InChatButton
            className="!w-[104px] !px-[12px]"
            onClick={onDownloadBattleLog}
          >
            Download
          </InChatButton>
        ) : null
      }
      bodyScroll={false}
      bodyClassName="flex flex-col"
    >
      <BattleLogPanelContent
        layout="mobile"
        showPanelTitle={false}
        battleLogNames={vm.battleLogNames}
        battleLogTurns={vm.battleLogTurns}
      />
    </MobileTakeoverShell>
  );
}
