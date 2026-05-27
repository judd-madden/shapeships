import { useEffect, useRef, useState } from 'react';
import { ChatSendButton } from '../../../components/ui/primitives/buttons/ChatSendButton';
import { InChatButton } from '../../../components/ui/primitives/buttons/InChatButton';
import { CopiedToast } from '../../../components/ui/primitives/CopiedToast';
import { CopyIcon } from '../../../components/ui/primitives/icons/CopyIcon';
import type { GameSessionActions, LeftRailViewModel } from '../../client/useGameSession';
import { LeftRailScrollArea } from '../layout/leftRail/LeftRailScrollArea';

interface ChatPanelContentProps {
  gameCode: LeftRailViewModel['gameCode'];
  chatMessages: LeftRailViewModel['chatMessages'];
  drawOffer: LeftRailViewModel['drawOffer'];
  onSendChat: GameSessionActions['onSendChat'];
  onAcceptDraw: GameSessionActions['onAcceptDraw'];
  onRefuseDraw: GameSessionActions['onRefuseDraw'];
  onCopyGameUrl: GameSessionActions['onCopyGameUrl'];
  onJoinRematchInvite?: GameSessionActions['onJoinRematchInvite'];
  layout?: 'desktop' | 'mobile';
  autoFocusInput?: boolean;
  showPanelTitle?: boolean;
}

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ');
}

export function ChatPanelContent({
  gameCode,
  chatMessages,
  drawOffer,
  onSendChat,
  onAcceptDraw,
  onRefuseDraw,
  onCopyGameUrl,
  onJoinRematchInvite,
  layout = 'desktop',
  autoFocusInput = false,
  showPanelTitle = true,
}: ChatPanelContentProps) {
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const copiedToastTimeoutRef = useRef<number | null>(null);
  const isMobile = layout === 'mobile';

  useEffect(() => {
    if (!autoFocusInput) {
      return;
    }

    inputRef.current?.focus();
  }, [autoFocusInput]);

  useEffect(() => {
    return () => {
      if (copiedToastTimeoutRef.current !== null) {
        window.clearTimeout(copiedToastTimeoutRef.current);
      }
    };
  }, []);

  function handleCopyUrl() {
    onCopyGameUrl();
    setShowCopiedToast(true);

    if (copiedToastTimeoutRef.current !== null) {
      window.clearTimeout(copiedToastTimeoutRef.current);
    }

    copiedToastTimeoutRef.current = window.setTimeout(() => {
      copiedToastTimeoutRef.current = null;
      setShowCopiedToast(false);
    }, 5000);
  }

  function handleSendChat() {
    const text = chatDraft.trim();
    if (text.length === 0) return;

    onSendChat(text);
    setChatDraft('');
  }

  return (
    <div className={cx('flex min-h-0 flex-col bg-black', isMobile ? 'h-full' : undefined)}>
      <div className="h-[42px] shrink-0 px-5 pt-3 pb-2 flex items-center justify-between relative">
        {showPanelTitle ? <p className="text-white text-[18px] font-black">Chat</p> : null}
        <button
          type="button"
          onClick={handleCopyUrl}
          className="flex items-center gap-[7px] opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
        >
          <p className="text-white text-[14px]">Game: {gameCode}</p>
          <CopyIcon />
        </button>
        {showCopiedToast && <CopiedToast className="absolute right-5 top-full mt-[6px]" />}
      </div>

      <LeftRailScrollArea
        outerClassName={cx(isMobile ? 'min-h-0 flex-1 px-5 pb-2' : 'h-[154px] px-5 pb-2')}
        innerClassName="justify-end gap-1 text-[15px]"
        stickToBottomOnChange
      >
        {chatMessages.map((msg, idx) => {
          if (msg.type === 'rematch_invite') {
            const targetGameId = msg.targetGameId;

            return (
              <div key={idx} className="mt-2">
                <p className="text-[var(--shapeships-pastel-green)] font-bold leading-[18px] mb-2">{msg.text}</p>
                {targetGameId && onJoinRematchInvite && (
                  <InChatButton onClick={() => onJoinRematchInvite(targetGameId)}>
                    Join Game
                  </InChatButton>
                )}
              </div>
            );
          }

          return (
            <p key={idx} className="text-[var(--shapeships-grey-20)] leading-[18px]">
              {msg.type === 'player' && (
                <>
                  <span className="font-bold">{msg.playerName}:</span>{' '}
                  <span className="font-normal">{msg.text}</span>
                </>
              )}
              {msg.type === 'system' && <span className="font-normal">{msg.text}</span>}
            </p>
          );
        })}

        {drawOffer && (
          <div className="mt-2">
            <p className="text-[var(--shapeships-pastel-green)] font-bold leading-[18px] mb-2">
              {drawOffer.fromPlayer} offers a draw
            </p>
            {drawOffer.canRespond && (
              <div className="flex gap-[10px]">
                <InChatButton onClick={onAcceptDraw}>Accept</InChatButton>
                <InChatButton onClick={onRefuseDraw}>Refuse</InChatButton>
              </div>
            )}
          </div>
        )}
      </LeftRailScrollArea>

      <div className="h-[47px] shrink-0">
        <div className="h-[1px] bg-[var(--shapeships-grey-70)] mx-5" />
        <div className="px-5 py-2 flex items-center justify-between">
          <input
            ref={inputRef}
            type="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="sentences"
            spellCheck={false}
            inputMode="text"
            enterKeyHint="send"
            value={chatDraft}
            onChange={(e) => setChatDraft(e.target.value)}
            placeholder="Be nice in chat"
            className="
              flex-1
              bg-transparent
              outline-none
              text-white
              text-[16px]
              not-italic
              placeholder:text-[var(--shapeships-grey-50)]
              placeholder:italic
              mr-3
            "
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSendChat();
              }
            }}
          />
          <ChatSendButton onClick={handleSendChat}>SEND</ChatSendButton>
        </div>
      </div>
    </div>
  );
}
