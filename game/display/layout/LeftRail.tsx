/**
 * Left Rail
 * Fixed-width left sidebar with brand, dice, turn/phase, chat, and battle log
 * NO LOGIC - displays view-model data only (Pass 1.25)
 */

import { Dice } from '../../../components/ui/primitives';
import { BuildIcon } from '../../../components/ui/primitives/icons/BuildIcon';
import { BattleIcon } from '../../../components/ui/primitives/icons/BattleIcon';
import { CopyIcon } from '../../../components/ui/primitives/icons/CopyIcon';
import { OpenFullIcon } from '../../../components/ui/primitives/icons/OpenFullIcon';
import { ChatSendButton } from '../../../components/ui/primitives/buttons/ChatSendButton';
import { InChatButton } from '../../../components/ui/primitives/buttons/InChatButton';
import type { LeftRailViewModel, GameSessionActions } from '../../client/useGameSession';

interface LeftRailProps {
  vm: LeftRailViewModel;
  actions: GameSessionActions;
  onBack?: () => void;
}

export function LeftRail({ vm, actions, onBack }: LeftRailProps) {
  return (
    <div className="w-[290px] h-full min-h-0 flex flex-col gap-5 pt-[25px] pb-[30px] shrink-0">
      {/* Brand / Title */}
      <div className="shrink-0 flex items-center justify-between">
        <div className="flex-1">
          <p className="font-['Inter'] font-bold text-[45px] leading-[45px] text-white text-center">
            SHAPESHIPS
          </p>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="fixed top-[25px] right-[30px] bg-black text-white px-4 py-2 rounded-md border-2 border-[#555] hover:bg-[#212121] transition-colors text-sm font-medium z-50"
          >
            Back
          </button>
        )}
      </div>

      {/* Dice Area */}
      <div className="shrink-0 flex justify-center">
        <Dice value={vm.diceValue} />
      </div>

      {/* Turn / Phase / Subphase Card */}
      <div className="shrink-0 rounded-[10px] border-2 border-[#555] overflow-hidden">
        {/* Turn and Major Phase */}
        <div className="bg-black p-[10px] flex items-center justify-center gap-[10px]">
          <p className="text-white text-[18px] font-bold">Turn {vm.turn} -</p>
          <p className="text-white text-[18px] font-bold">{vm.phase}</p>
          {vm.phaseIcon === 'build' ? <BuildIcon /> : <BattleIcon />}
        </div>
        
        {/* Subphase */}
        <div className="bg-[#212121] px-[10px] py-[10px] pb-[12px]">
          <p className="text-white text-[18px] font-medium text-center">{vm.subphase}</p>
        </div>
      </div>

      {/* Chat Area (fixed height, scrollable) */}
      <div className="shrink-0 h-[243px] bg-black rounded-[10px] border-2 border-[#555] flex flex-col">
        {/* Chat Header */}
        <div className="px-5 pt-3 pb-2 flex items-center justify-between shrink-0">
          <p className="text-white text-[18px] font-black">Chat</p>
          <button className="flex items-center gap-[7px] opacity-50 hover:opacity-100 transition-opacity cursor-pointer">
            <p className="text-white text-[14px]">Game: {vm.gameCode}</p>
            <CopyIcon />
          </button>
        </div>

        {/* Chat Content (scrollable) */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden break-words px-5 pb-2 flex flex-col gap-1 justify-end text-[15px]">
          {vm.chatMessages.map((msg, idx) => (
            <p key={idx} className="text-[#d4d4d4] leading-[18px]">
              {msg.type === 'player' && (
                <>
                  <span className="font-bold">{msg.playerName}:</span>{' '}
                  <span className="font-normal">{msg.text}</span>
                </>
              )}
              {msg.type === 'system' && (
                <span className="font-normal">{msg.text}</span>
              )}
            </p>
          ))}
          
          {/* Draw Offer */}
          {vm.drawOffer && (
            <div className="mt-2">
              <p className="text-[#9cff84] font-bold leading-[18px] mb-2">
                {vm.drawOffer.fromPlayer} offers a draw
              </p>
              <div className="flex gap-[10px]">
                <InChatButton onClick={actions.onAcceptDraw}>Accept</InChatButton>
                <InChatButton onClick={actions.onRefuseDraw}>Refuse</InChatButton>
              </div>
            </div>
          )}
        </div>

        {/* HR */}
        <div className="h-[1px] bg-[#555] mx-5 shrink-0" />

        {/* Chat Entry */}
        <div className="px-5 py-2 flex items-center justify-between shrink-0">
          <p className="text-[#888] text-[16px] italic">Be nice in chat</p>
          <ChatSendButton onClick={() => actions.onSendChat('test')}>SEND</ChatSendButton>
        </div>
      </div>

      {/* Battle Log Area (fills remaining height, scrollable) */}
      <div className="flex-1 bg-black rounded-[10px] border-2 border-[#555] flex flex-col min-h-0">
        {/* Battle Log Header */}
        <div className="px-5 pt-3 pb-2 flex items-center justify-between shrink-0">
          <p className="text-white text-[18px] font-black">Battle Log</p>
          <div className="flex items-center gap-[5px]">
            <button 
              className="bg-black rounded-[7px] p-0 opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
              onClick={actions.onOpenBattleLogFullscreen}
            >
              <OpenFullIcon />
            </button>
          </div>
        </div>

        {/* Battle Log Content (scrollable) */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden break-words px-5 pb-3 flex flex-col gap-[10px] justify-end text-[15px] text-[#d4d4d4]">
          {vm.battleLogEntries.map((entry, idx) => {
            if (entry.type === 'turn-marker') {
              return (
                <div key={idx} className="flex items-center gap-2">
                  <p className="text-[#888] text-[15px] shrink-0">
                    <span className="font-bold">Turn {entry.turn} - </span>{entry.phase}
                  </p>
                  <div className="flex-1 h-[1px] bg-[#555]" />
                </div>
              );
            }
            
            return (
              <p key={idx} className="leading-[normal]">{entry.text}</p>
            );
          })}
        </div>
      </div>
    </div>
  );
}