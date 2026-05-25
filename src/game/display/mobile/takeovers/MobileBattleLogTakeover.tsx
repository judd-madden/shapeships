import type { LeftRailViewModel } from '../../../client/useGameSession';
import { BattleLogPanelContent } from '../../shared/BattleLogPanelContent';
import { MobileTakeoverShell } from './MobileTakeoverShell';

interface MobileBattleLogTakeoverProps {
  vm: LeftRailViewModel;
  onClose: () => void;
}

export function MobileBattleLogTakeover({ vm, onClose }: MobileBattleLogTakeoverProps) {
  return (
    <MobileTakeoverShell
      title="Battle Log"
      onClose={onClose}
      bodyScroll={false}
      bodyClassName="flex flex-col"
    >
      <BattleLogPanelContent
        layout="mobile"
        showPanelTitle={false}
        battleLogNames={vm.battleLogNames}
        battleLogTurns={vm.battleLogTurns}
        battleLogAutoScrollKey={vm.battleLogAutoScrollKey}
      />
    </MobileTakeoverShell>
  );
}
