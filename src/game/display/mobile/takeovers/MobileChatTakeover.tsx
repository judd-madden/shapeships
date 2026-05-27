import type { GameSessionActions, LeftRailViewModel } from '../../../client/useGameSession';
import { ChatPanelContent } from '../../shared/ChatPanelContent';
import { MobileTakeoverShell } from './MobileTakeoverShell';

interface MobileChatTakeoverProps {
  vm: LeftRailViewModel;
  actions: GameSessionActions;
  onClose: () => void;
}

export function MobileChatTakeover({ vm, actions, onClose }: MobileChatTakeoverProps) {
  return (
    <MobileTakeoverShell
      title="Chat"
      onClose={onClose}
      heightMode="content"
      panelClassName="h-[42dvh] max-h-[400px]"
      bodyScroll={false}
      bodyClassName="flex min-h-0 flex-col"
    >
      <ChatPanelContent
        layout="mobile"
        autoFocusInput
        showPanelTitle={false}
        gameCode={vm.gameCode}
        chatMessages={vm.chatMessages}
        drawOffer={vm.drawOffer}
        onSendChat={actions.onSendChat}
        onAcceptDraw={actions.onAcceptDraw}
        onRefuseDraw={actions.onRefuseDraw}
        onCopyGameUrl={actions.onCopyGameUrl}
        onJoinRematchInvite={actions.onJoinRematchInvite}
      />
    </MobileTakeoverShell>
  );
}
