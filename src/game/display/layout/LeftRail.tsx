/**
 * Left Rail
 * Fixed-width left sidebar with brand, dice, turn/phase, chat, and battle log
 * Presentation-first layout with small local UI timing for rail-only effects.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Dice } from '../../../components/ui/primitives';
import { BuildIcon } from '../../../components/ui/primitives/icons/BuildIcon';
import { BattleIcon } from '../../../components/ui/primitives/icons/BattleIcon';
import { CloseIcon } from '../../../components/ui/primitives/icons/CloseIcon';
import { CopyIcon } from '../../../components/ui/primitives/icons/CopyIcon';
import { OpenFullIcon } from '../../../components/ui/primitives/icons/OpenFullIcon';
import { ChatSendButton } from '../../../components/ui/primitives/buttons/ChatSendButton';
import { InChatButton } from '../../../components/ui/primitives/buttons/InChatButton';
import { CopiedToast } from '../../../components/ui/primitives/CopiedToast';
import type { LeftRailViewModel, GameSessionActions } from '../../client/useGameSession';
import { LeftRailScrollArea } from './leftRail/LeftRailScrollArea';
import { BattleLogTurnCard } from './leftRail/BattleLogTurnCard';
import { getShipDefinitionUI } from '../../data/ShipDefinitionsUI';
import { resolveShipGraphic } from '../graphics/resolveShipGraphic';
import { useLeftRailTurnTakeover } from '../graphics/animation';

interface LeftRailProps {
  vm: LeftRailViewModel;
  actions: GameSessionActions;
  firstTurnBuildHelperEligible?: boolean;
  firstTurnBuildHelperDismissSignal?: number;
  onFirstTurnBuildHelperDismiss?: () => void;
}

const FIRST_TURN_BUILD_HELPER_SHOW_DELAY_MS = 500;
const FIRST_TURN_BUILD_HELPER_FADE_MS = 150;
const BATTLE_LOG_OVERLAY_BOTTOM_INSET_PX = 25;
const BATTLE_LOG_TRANSITION_MS = 160;

export function LeftRail({
  vm,
  actions,
  firstTurnBuildHelperEligible = false,
  firstTurnBuildHelperDismissSignal = 0,
  onFirstTurnBuildHelperDismiss,
}: LeftRailProps) {
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const [isBattleLogExpanded, setIsBattleLogExpanded] = useState(false);
  const [collapsedBattleLogTop, setCollapsedBattleLogTop] = useState<number | null>(null);
  const [isFirstTurnBuildHelperMounted, setIsFirstTurnBuildHelperMounted] = useState(false);
  const [isFirstTurnBuildHelperVisible, setIsFirstTurnBuildHelperVisible] = useState(false);
  const railRootRef = useRef<HTMLDivElement | null>(null);
  const battleLogSlotRef = useRef<HTMLDivElement | null>(null);
  const battleLogViewportRef = useRef<HTMLDivElement | null>(null);
  const pendingBattleLogScrollRestoreRef = useRef<{ distanceFromBottom: number } | null>(null);
  const battleLogScrollRestoreFrameRef = useRef<number | null>(null);
  const battleLogScrollRestoreTimeoutRef = useRef<number | null>(null);
  const firstTurnBuildHelperShowTimeoutRef = useRef<number | null>(null);
  const firstTurnBuildHelperDismissTimeoutRef = useRef<number | null>(null);
  const turnTakeover = useLeftRailTurnTakeover({
    turn: vm.turnTakeoverTurn,
    animateKey: vm.turnTakeoverAnimateKey,
  });

  function clearBattleLogScrollRestoreTimers() {
    if (battleLogScrollRestoreFrameRef.current !== null) {
      window.cancelAnimationFrame(battleLogScrollRestoreFrameRef.current);
      battleLogScrollRestoreFrameRef.current = null;
    }

    if (battleLogScrollRestoreTimeoutRef.current !== null) {
      window.clearTimeout(battleLogScrollRestoreTimeoutRef.current);
      battleLogScrollRestoreTimeoutRef.current = null;
    }
  }

  function restoreBattleLogScrollPosition() {
    const snapshot = pendingBattleLogScrollRestoreRef.current;
    const viewport = battleLogViewportRef.current;
    if (!snapshot || !viewport) {
      return;
    }

    if (viewport.scrollHeight <= viewport.clientHeight) {
      return;
    }

    const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    const nextScrollTop = viewport.scrollHeight - viewport.clientHeight - snapshot.distanceFromBottom;
    viewport.scrollTop = Math.max(0, Math.min(maxScrollTop, nextScrollTop));
  }

  function scheduleBattleLogScrollRestore() {
    if (!pendingBattleLogScrollRestoreRef.current) {
      return;
    }

    clearBattleLogScrollRestoreTimers();
    restoreBattleLogScrollPosition();

    const endTime = performance.now() + BATTLE_LOG_TRANSITION_MS + 40;
    const tick = () => {
      restoreBattleLogScrollPosition();

      if (performance.now() >= endTime) {
        battleLogScrollRestoreFrameRef.current = null;
        pendingBattleLogScrollRestoreRef.current = null;
        return;
      }

      battleLogScrollRestoreFrameRef.current = window.requestAnimationFrame(tick);
    };

    battleLogScrollRestoreFrameRef.current = window.requestAnimationFrame(tick);
    battleLogScrollRestoreTimeoutRef.current = window.setTimeout(() => {
      restoreBattleLogScrollPosition();
      pendingBattleLogScrollRestoreRef.current = null;
      clearBattleLogScrollRestoreTimers();
    }, BATTLE_LOG_TRANSITION_MS + 80);
  }

  function clearFirstTurnBuildHelperShowTimeout() {
    if (firstTurnBuildHelperShowTimeoutRef.current !== null) {
      window.clearTimeout(firstTurnBuildHelperShowTimeoutRef.current);
      firstTurnBuildHelperShowTimeoutRef.current = null;
    }
  }

  function clearFirstTurnBuildHelperDismissTimeout() {
    if (firstTurnBuildHelperDismissTimeoutRef.current !== null) {
      window.clearTimeout(firstTurnBuildHelperDismissTimeoutRef.current);
      firstTurnBuildHelperDismissTimeoutRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      clearBattleLogScrollRestoreTimers();
      clearFirstTurnBuildHelperShowTimeout();
      clearFirstTurnBuildHelperDismissTimeout();
    };
  }, []);

  useLayoutEffect(() => {
    const railRoot = railRootRef.current;
    const battleLogSlot = battleLogSlotRef.current;
    if (!railRoot || !battleLogSlot) {
      return;
    }

    const measureCollapsedBattleLogTop = () => {
      const railRect = railRoot.getBoundingClientRect();
      const slotRect = battleLogSlot.getBoundingClientRect();
      const nextTop = Math.max(0, slotRect.top - railRect.top);

      setCollapsedBattleLogTop((currentTop) =>
        currentTop !== null && Math.abs(currentTop - nextTop) < 0.5 ? currentTop : nextTop
      );
    };

    measureCollapsedBattleLogTop();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measureCollapsedBattleLogTop) : null;
    resizeObserver?.observe(railRoot);
    resizeObserver?.observe(battleLogSlot);

    window.addEventListener('resize', measureCollapsedBattleLogTop);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', measureCollapsedBattleLogTop);
    };
  }, []);

  useLayoutEffect(() => {
    if (!pendingBattleLogScrollRestoreRef.current) {
      return;
    }

    scheduleBattleLogScrollRestore();
    return () => {
      clearBattleLogScrollRestoreTimers();
    };
  }, [isBattleLogExpanded, collapsedBattleLogTop]);

  useEffect(() => {
    if (firstTurnBuildHelperDismissSignal === 0) {
      return;
    }

    setIsFirstTurnBuildHelperMounted(true);
    clearFirstTurnBuildHelperShowTimeout();
    clearFirstTurnBuildHelperDismissTimeout();
    setIsFirstTurnBuildHelperVisible(false);

    firstTurnBuildHelperDismissTimeoutRef.current = window.setTimeout(() => {
      firstTurnBuildHelperDismissTimeoutRef.current = null;
      setIsFirstTurnBuildHelperMounted(false);
    }, FIRST_TURN_BUILD_HELPER_FADE_MS);
  }, [firstTurnBuildHelperDismissSignal]);

  useEffect(() => {
    if (!firstTurnBuildHelperEligible) {
      clearFirstTurnBuildHelperShowTimeout();
      clearFirstTurnBuildHelperDismissTimeout();
      setIsFirstTurnBuildHelperMounted(false);
      setIsFirstTurnBuildHelperVisible(false);
      return;
    }

    if (firstTurnBuildHelperDismissSignal > 0) {
      clearFirstTurnBuildHelperShowTimeout();
      return;
    }

    clearFirstTurnBuildHelperShowTimeout();
    setIsFirstTurnBuildHelperMounted(true);
    setIsFirstTurnBuildHelperVisible(false);

    firstTurnBuildHelperShowTimeoutRef.current = window.setTimeout(() => {
      firstTurnBuildHelperShowTimeoutRef.current = null;
      setIsFirstTurnBuildHelperVisible(true);
    }, FIRST_TURN_BUILD_HELPER_SHOW_DELAY_MS);

    return () => {
      clearFirstTurnBuildHelperShowTimeout();
    };
  }, [firstTurnBuildHelperEligible, firstTurnBuildHelperDismissSignal]);

  function renderDiceManipulationSlot(side: 'left' | 'right') {
    const slot = vm.diceManipulationSlots[side];
    if (!slot) return null;

    const def = getShipDefinitionUI(slot.sourceShipDefId);
    if (!def) return null;
    const graphic = resolveShipGraphic(def, { context: 'default' });
    const ShipGraphic = graphic?.component ?? null;

    const slotStyle =
      side === 'left'
        ? {
            position: 'absolute' as const,
            top: 110,
            left: 0,
            zIndex: 40,
            display: 'flex',
            flexDirection: 'column' as const,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: 'max-content',
            pointerEvents: 'none' as const,
          }
        : {
            position: 'absolute' as const,
            top: 110,
            left: 230,
            zIndex: 40,
            display: 'flex',
            flexDirection: 'column' as const,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: 'max-content',
            pointerEvents: 'none' as const,
          };

    const diceValues = Array.isArray(slot.diceValues) ? slot.diceValues : [];
    const showDiceSpacer = slot.sourceShipDefId === 'KNO' && diceValues.length === 0;

    return (
      <div style={slotStyle}>
        {diceValues.length > 0 ? (
          <div className="flex flex-nowrap items-center gap-0" style={{ width: 'max-content' }}>
            {diceValues.map((value, index) => (
              <Dice
                key={`${slot.sourceShipDefId}-${index}`}
                value={value}
                animateKey={slot.sourceShipDefId === 'CHR' ? slot.animateKey : undefined}
                className="w-[60px] h-[60px]"
                enableRotate={false}
              />
            ))}
          </div>
        ) : showDiceSpacer ? (
          <div className="w-[60px] h-[60px]" aria-hidden="true" />
        ) : null}

        {ShipGraphic && (
          <div className="w-[52px] h-[52px]">
            <ShipGraphic className="w-[52px] h-[52px]" />
          </div>
        )}
      </div>
    );
  }

  function handleCopyUrl() {
    actions.onCopyGameUrl();
    setShowCopiedToast(true);
    window.setTimeout(() => {
      setShowCopiedToast(false);
    }, 5000);
  }

  function handleBattleLogExpandToggle() {
    const viewport = battleLogViewportRef.current;
    if (viewport && viewport.scrollHeight > viewport.clientHeight) {
      pendingBattleLogScrollRestoreRef.current = {
        distanceFromBottom: viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight,
      };
    } else {
      pendingBattleLogScrollRestoreRef.current = null;
    }

    setIsBattleLogExpanded((current) => !current);
  }

  const battleLogOverlayTop = isBattleLogExpanded ? 20 : (collapsedBattleLogTop ?? 0);

  return (
    <div
      ref={railRootRef}
      className="relative w-[290px] self-stretch min-h-0 flex flex-col gap-5 pt-[25px] pb-[25px] shrink-0"
    >
      {isFirstTurnBuildHelperMounted && (
        <div
          className="pointer-events-none absolute left-[250px] top-[100px] z-30"
          style={{
            opacity: isFirstTurnBuildHelperVisible ? 1 : 0,
            transition: `opacity ${FIRST_TURN_BUILD_HELPER_FADE_MS}ms ease-out`,
          }}
        >
          <div
            className="pointer-events-auto relative flex w-max max-w-[290px] flex-col gap-[12px] rounded-[10px] bg-[var(--shapeships-pastel-green)] pb-[20px] pl-[24px] pr-[24px] pt-[16px] text-left text-[var(--shapeships-black)]"
            onClick={onFirstTurnBuildHelperDismiss}
          >
            <div
              aria-hidden="true"
              className="absolute left-[-6px] top-[50px] size-[12px] rotate-45 bg-[var(--shapeships-pastel-green)]"
            />
            <p
              className="font-['Roboto'] text-[26px] font-black leading-[1.05]"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              The dice gives lines to both players.
            </p>
            <div className="flex flex-col gap-[12px]">
              <p
                className="font-['Roboto'] text-[18px] font-normal leading-[1.2]"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                You start with <span className="font-bold">3 saved lines</span>.
              </p>
              <p
                className="font-['Roboto'] text-[18px] font-normal leading-[1.2]"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Spend lines to build ships. Unspent lines are saved.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Brand / Title */}
      <div className="shrink-0 flex items-center justify-between">
        <div className="flex-1">
          <p className="font-['Roboto'] font-bold text-[45px] leading-[45px] text-white text-center">
            SHAPESHIPS
          </p>
        </div>
      </div>

      {/* Dice Area */}
      <div className="shrink-0 flex justify-center">
        <Dice value={vm.diceValue} animateKey={vm.diceAnimateKey} />
      </div>

      {renderDiceManipulationSlot('left')}
      {renderDiceManipulationSlot('right')}

      {/* Turn / Phase / Subphase Card */}
      <div className="relative shrink-0 rounded-[10px] border-2 border-[#555] overflow-hidden">
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

        {turnTakeover.turn !== null && (
          <div
            key={turnTakeover.runKey}
            aria-hidden="true"
            className="ss-leftRailTurnTakeover"
            data-run-key={turnTakeover.runKey}
            style={turnTakeover.timingStyle}
            onAnimationEnd={turnTakeover.onOverlayAnimationEnd}
          >
            <div className="ss-leftRailTurnTakeover__wipe" />
            <div className="ss-leftRailTurnTakeover__textWrap">
              <p className="ss-leftRailTurnTakeover__text font-['Roboto'] text-[60px] leading-none font-black italic">
                Turn <span className="tracking-tighter">{turnTakeover.turn}</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Chat Area (fixed height, scrollable) */}
      <div className="shrink-0 bg-black rounded-[10px] border-2 border-[#555] overflow-hidden">
        {/* Row 1: Chat Header */}
        <div className="h-[42px] px-5 pt-3 pb-2 flex items-center justify-between relative">
          <p className="text-white text-[18px] font-black">Chat</p>
          <button
            type="button"
            onClick={handleCopyUrl}
            className="flex items-center gap-[7px] opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
          >
            <p className="text-white text-[14px]">Game: {vm.gameCode}</p>
            <CopyIcon />
          </button>
          {showCopiedToast && (
            <CopiedToast className="absolute right-5 top-full mt-[6px]" />
          )}
        </div>
      
        {/* Row 2: Chat Content (scrollable) */}
        <LeftRailScrollArea
          outerClassName="h-[154px] px-5 pb-2"
          innerClassName="justify-end gap-1 text-[15px]"
          stickToBottomOnChange
        >
          {vm.chatMessages.map((msg, idx) => {
            if (msg.type === 'rematch_invite') {
              const targetGameId = msg.targetGameId;

              return (
                <div key={idx} className="mt-2">
                  <p className="text-[#9cff84] font-bold leading-[18px] mb-2">{msg.text}</p>
                  {targetGameId && actions.onJoinRematchInvite && (
                    <InChatButton onClick={() => actions.onJoinRematchInvite?.(targetGameId)}>
                      Join Game
                    </InChatButton>
                  )}
                </div>
              );
            }

            return (
              <p key={idx} className="text-[#d4d4d4] leading-[18px]">
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
        
          {vm.drawOffer && (
            <div className="mt-2">
              <p className="text-[#9cff84] font-bold leading-[18px] mb-2">
                {vm.drawOffer.fromPlayer} offers a draw
              </p>
              {vm.drawOffer.canRespond && (
                <div className="flex gap-[10px]">
                  <InChatButton onClick={actions.onAcceptDraw}>Accept</InChatButton>
                  <InChatButton onClick={actions.onRefuseDraw}>Refuse</InChatButton>
                </div>
              )}
            </div>
          )}
        </LeftRailScrollArea>

      
        {/* Row 3: Divider + Entry (fixed) */}
        <div className="h-[47px]">
          <div className="h-[1px] bg-[#555] mx-5" />
          <div className="px-5 py-2 flex items-center justify-between">
            <input
              type="text"
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
                placeholder:text-[#888]
                placeholder:italic
                mr-3
              "
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const text = chatDraft.trim();
                  if (text.length === 0) return;
                  actions.onSendChat(text);
                  setChatDraft('');
                }
              }}
            />
            <ChatSendButton
              onClick={() => {
                const text = chatDraft.trim();
                if (text.length === 0) return;
                actions.onSendChat(text);
                setChatDraft('');
              }}
            >
              SEND
            </ChatSendButton>
          </div>
        </div>
      </div>

      {/* Battle Log slot preserves layout while the real card overlays above it. */}
      <div ref={battleLogSlotRef} className="basis-0 flex-1 min-h-0" aria-hidden="true" />

      <div
        className="absolute left-0 right-0 z-50 flex min-h-0 flex-col rounded-[10px] border-2 border-[#555] bg-black"
        style={{
          top: battleLogOverlayTop,
          // Match the current rail pb-[25px] inset so the overlay never drops below the collapsed card.
          bottom: BATTLE_LOG_OVERLAY_BOTTOM_INSET_PX,
          transition: collapsedBattleLogTop === null ? undefined : `top ${BATTLE_LOG_TRANSITION_MS}ms ease-out`,
        }}
      >
        <div className="shrink-0 bg-black rounded-t-[10px] border-b border-[var(--shapeships-grey-70)] px-[20px] py-[12px] flex flex-col gap-[8px]">
          <div className="flex items-center justify-between">
            <p className="text-white text-[18px] font-black">Battle Log</p>
            <button
              className="bg-black rounded-[7px] p-0 opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
              onClick={handleBattleLogExpandToggle}
            >
              {isBattleLogExpanded ? <CloseIcon /> : <OpenFullIcon />}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-[20px] text-[15px] leading-none text-[var(--shapeships-grey-20)]">
            <p className="text-left font-bold">{vm.battleLogNames.me}</p>
            <p className="text-right font-bold">{vm.battleLogNames.opponent}</p>
          </div>
        </div>

        <LeftRailScrollArea
          viewportRef={battleLogViewportRef}
          outerClassName="basis-0 rounded-b-[10px] flex-1 pb-3"
          forceScrollOnChangeKey={vm.battleLogAutoScrollKey}
        >
          {vm.battleLogTurns.map((turn) => (
            <BattleLogTurnCard key={turn.turnNumber} turn={turn} />
          ))}
        </LeftRailScrollArea>
      </div>
    </div>
  );
}
