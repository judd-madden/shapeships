/**
 * Left Rail
 * Fixed-width left sidebar with brand, sister panel, phase indicator, and chat
 * Presentation-first layout with small local UI timing for rail-only effects.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CloseIcon } from '../../../components/ui/primitives/icons/CloseIcon';
import { OpenFullIcon } from '../../../components/ui/primitives/icons/OpenFullIcon';
import type { LeftRailViewModel, GameSessionActions, GameSessionViewModel, TurnPhasePresentationVm, TurnPhaseVm } from '../../client/useGameSession';
import { BattleLogPanelContent } from '../shared/BattleLogPanelContent';
import { ChatPanelContent } from '../shared/ChatPanelContent';
import { TurnPhaseIndicator } from '../shared/TurnPhaseIndicator';
import { TurnPhaseList } from '../shared/TurnPhaseList';
import { LeftRailScrollArea } from './leftRail/LeftRailScrollArea';
import { WinStreakPanelContent } from '../winStreak/WinStreakContent';
import {
  canSubmitInGameWinStreakReset,
  getInGameWinStreakResetAction,
  getWinStreakTabLayout,
  resolveWinStreakSisterView,
  shouldShowWinStreakContent,
  type WinStreakSisterView,
} from '../winStreak/winStreakPresentation';

interface LeftRailProps {
  vm: LeftRailViewModel;
  turnPhases: TurnPhaseVm;
  turnPhasePresentation: TurnPhasePresentationVm;
  actions: GameSessionActions;
  winStreak: GameSessionViewModel['winStreak'];
  canResign: boolean;
  isFinished: boolean;
  isPlayerViewer: boolean;
}

type SisterView = WinStreakSisterView;

const BATTLE_LOG_TRANSITION_MS = 160;
const BATTLE_LOG_SESSION_PREFERENCE_KEY = 'shapeships.preferBattleLog.v1';
const CHAT_MINIMIZED_STORAGE_KEY = 'shapeships.chatMinimized.v1';

function readInitialSisterView(): SisterView {
  if (typeof window === 'undefined') {
    return 'turnPhases';
  }

  try {
    return window.sessionStorage.getItem(BATTLE_LOG_SESSION_PREFERENCE_KEY) === 'true'
      ? 'battleLog'
      : 'turnPhases';
  } catch {
    return 'turnPhases';
  }
}

function persistBattleLogSessionPreference() {
  try {
    window.sessionStorage.setItem(BATTLE_LOG_SESSION_PREFERENCE_KEY, 'true');
  } catch {
    // Keep the game usable when session storage is unavailable.
  }
}

function readInitialChatMinimized(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const storedValue = window.localStorage.getItem(CHAT_MINIMIZED_STORAGE_KEY);

    if (storedValue === 'true') {
      return true;
    }

    if (storedValue === 'false') {
      return false;
    }

    return false;
  } catch {
    return false;
  }
}

function persistChatMinimizedPreference(isMinimized: boolean) {
  try {
    window.localStorage.setItem(CHAT_MINIMIZED_STORAGE_KEY, String(isMinimized));
  } catch {
    // Keep the preference in memory if browser storage is unavailable.
  }
}

export function LeftRail({
  vm,
  turnPhases,
  turnPhasePresentation,
  actions,
  winStreak,
  canResign,
  isFinished,
  isPlayerViewer,
}: LeftRailProps) {
  const [selectedSisterView, setSelectedSisterView] = useState<SisterView>(readInitialSisterView);
  const [isBattleLogExpanded, setIsBattleLogExpanded] = useState(false);
  const [isChatMinimized, setIsChatMinimized] = useState(readInitialChatMinimized);
  const [collapsedBattleLogTop, setCollapsedBattleLogTop] = useState<number | null>(null);
  const [collapsedBattleLogBottom, setCollapsedBattleLogBottom] = useState<number | null>(null);
  const railRootRef = useRef<HTMLDivElement | null>(null);
  const battleLogSlotRef = useRef<HTMLDivElement | null>(null);
  const battleLogViewportRef = useRef<HTMLDivElement | null>(null);
  const pendingBattleLogScrollRestoreRef = useRef<{ scrollTop: number } | null>(null);
  const battleLogScrollRestoreFrameRef = useRef<number | null>(null);
  const battleLogScrollRestoreTimeoutRef = useRef<number | null>(null);
  const previousIsFinishedRef = useRef(isFinished);
  const showWinStreak = shouldShowWinStreakContent(winStreak);
  const winStreakTabLayout = getWinStreakTabLayout(showWinStreak);

  useEffect(() => {
    setSelectedSisterView((current) => resolveWinStreakSisterView(current, showWinStreak));
  }, [showWinStreak]);
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
    viewport.scrollTop = Math.max(0, Math.min(maxScrollTop, snapshot.scrollTop));
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

  useEffect(() => {
    return () => {
      clearBattleLogScrollRestoreTimers();
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
      const nextBottom = Math.max(0, railRect.bottom - slotRect.bottom);

      setCollapsedBattleLogTop((currentTop) =>
        currentTop !== null && Math.abs(currentTop - nextTop) < 0.5 ? currentTop : nextTop
      );
      setCollapsedBattleLogBottom((currentBottom) =>
        currentBottom !== null && Math.abs(currentBottom - nextBottom) < 0.5
          ? currentBottom
          : nextBottom
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
  }, [isBattleLogExpanded, collapsedBattleLogTop, collapsedBattleLogBottom]);

  useEffect(() => {
    setIsBattleLogExpanded(false);
  }, [vm.gameCode]);

  useEffect(() => {
    const wasFinished = previousIsFinishedRef.current;

    if (!wasFinished && isFinished && isPlayerViewer && selectedSisterView === 'battleLog') {
      persistBattleLogSessionPreference();
    }

    previousIsFinishedRef.current = isFinished;
  }, [isFinished, isPlayerViewer, selectedSisterView]);

  function handleBattleLogExpandToggle() {
    const viewport = battleLogViewportRef.current;
    if (viewport && viewport.scrollHeight > viewport.clientHeight) {
      pendingBattleLogScrollRestoreRef.current = {
        scrollTop: viewport.scrollTop,
      };
    } else {
      pendingBattleLogScrollRestoreRef.current = null;
    }

    setIsBattleLogExpanded((current) => !current);
  }

  function handleSisterViewSelect(nextView: SisterView) {
    if (nextView === 'turnPhases' && isBattleLogExpanded) {
      handleBattleLogExpandToggle();
    }
    setSelectedSisterView(nextView);
  }

  function handleChatMinimizedChange(nextIsMinimized: boolean) {
    setIsChatMinimized(nextIsMinimized);
    persistChatMinimizedPreference(nextIsMinimized);
  }

  const battleLogOverlayTop = isBattleLogExpanded ? 20 : (collapsedBattleLogTop ?? 0);
  const battleLogOverlayBottom = isBattleLogExpanded
    ? 'var(--battle-log-bottom-inset, 25px)'
    : (collapsedBattleLogBottom ?? 0);

  return (
    <div
      ref={railRootRef}
      className="relative w-[250px] 2xl:w-[290px] self-stretch min-h-0 flex flex-col gap-5 pt-[25px] pb-[25px] shrink-0 hidden lg:flex [--battle-log-bottom-inset:25px] min-[768px]:max-[1599px]:gap-4 min-[768px]:max-[1599px]:pt-[16px] min-[768px]:max-[1599px]:pb-[16px] min-[768px]:max-[1599px]:[--battle-log-bottom-inset:16px]"
    >
      {/* Brand / Title */}
      <div className="shrink-0 flex items-center justify-between">
        <div className="flex-1">
          <p className="font-bold text-[45px] leading-[45px] text-white text-center min-[768px]:max-[1599px]:text-[40px] min-[768px]:max-[1599px]:leading-[40px]">
            SHAPESHIPS
          </p>
        </div>
      </div>

      {/* The sister-panel slot owns the rail's primary flexible height. */}
      <div ref={battleLogSlotRef} className="basis-0 flex-1 min-h-[120px]" aria-hidden="true" />

      <div className="-mt-1 shrink-0 min-[768px]:max-[1599px]:mt-0">
        <TurnPhaseIndicator vm={turnPhases} presentation={turnPhasePresentation} />
      </div>

      {/* Expanded Chat may compress to 243px; minimized Chat remains one fixed row. */}
      <div
        className={`-mt-1 overflow-hidden rounded-[10px] border-2 border-[var(--shapeships-grey-70)] bg-[var(--shapeships-black)] min-[768px]:max-[1599px]:mt-0 ${
          isChatMinimized
            ? 'h-[48px] min-h-[48px] max-h-[48px] shrink-0'
            : 'h-[302px] min-h-[243px] max-h-[302px] shrink'
        }`}
      >
        <ChatPanelContent
          layout="desktop"
          isMinimized={isChatMinimized}
          onMinimizedChange={handleChatMinimizedChange}
          gameCode={vm.gameCode}
          chatMessages={vm.chatMessages}
          drawOffer={vm.drawOffer}
          onSendChat={actions.onSendChat}
          onAcceptDraw={actions.onAcceptDraw}
          onRefuseDraw={actions.onRefuseDraw}
          onCopyGameUrl={actions.onCopyGameUrl}
          onJoinRematchInvite={actions.onJoinRematchInvite}
        />
      </div>

      <div
        className="absolute left-0 right-0 z-50 flex min-h-0 flex-col rounded-[10px] border-2 border-[var(--shapeships-grey-70)] bg-[var(--shapeships-black)] mt-[4px]"
        style={{
          top: battleLogOverlayTop,
          bottom: battleLogOverlayBottom,
          transition:
            collapsedBattleLogTop === null
              ? undefined
              : `top ${BATTLE_LOG_TRANSITION_MS}ms ease-out, bottom ${BATTLE_LOG_TRANSITION_MS}ms ease-out`,
        }}
      >
        <div className={`flex h-[48px] shrink-0 items-center justify-between ${
          winStreakTabLayout === 'two-tab' ? 'px-[18px]' : 'px-[12px]'
        }`}>
          <div className={`flex min-w-0 items-center ${
            winStreakTabLayout === 'two-tab' ? 'gap-[18px]' : 'gap-[12px]'
          }`}>
            {showWinStreak ? (
              <button
                type="button"
                className={`shrink-0 text-[14px] 2xl:text-[16px] font-bold hover:underline cursor-pointer transition-opacity ${
                  selectedSisterView === 'winStreak' ? 'text-white' : 'text-[var(--shapeships-pastel-green)]'
                }`}
                onClick={() => handleSisterViewSelect('winStreak')}
              >
                {winStreak.displayCount}W
              </button>
            ) : null}
            <button
              type="button"
              className={`text-[14px] 2xl:text-[16px] font-bold hover:underline cursor-pointer ${
                selectedSisterView === 'turnPhases'
                  ? 'text-[var(--shapeships-white)]'
                  : 'text-[var(--shapeships-grey-50)]'
              }`}
              onClick={() => handleSisterViewSelect('turnPhases')}
            >
              Turn Phases
            </button>
            <button
              type="button"
              className={`text-[14px] 2xl:text-[16px] font-bold hover:underline cursor-pointer ${
                selectedSisterView === 'battleLog'
                  ? 'text-[var(--shapeships-white)]'
                  : 'text-[var(--shapeships-grey-50)]'
              }`}
              onClick={() => handleSisterViewSelect('battleLog')}
            >
              Battle Log
              {selectedSisterView !== 'battleLog'
                ? ` (${vm.battleLogCompletedTurnCount})`
                : null}
            </button>
          </div>
          {selectedSisterView === 'battleLog' ? (
            <button
              type="button"
              aria-label={isBattleLogExpanded ? 'Collapse Battle Log' : 'Expand Battle Log'}
              className="rounded-[7px] bg-[var(--shapeships-black)] p-0 opacity-50 transition-opacity hover:opacity-100 cursor-pointer"
              onClick={handleBattleLogExpandToggle}
            >
              {isBattleLogExpanded ? <CloseIcon /> : <OpenFullIcon />}
            </button>
          ) : null}
        </div>

        <div className="relative basis-0 flex-1 min-h-0">
          <div
            aria-hidden={selectedSisterView !== 'battleLog'}
            inert={
              (selectedSisterView !== 'battleLog' ? '' : undefined) as unknown as boolean | undefined
            }
            className={`absolute inset-0 min-h-0 ${
              selectedSisterView === 'battleLog' ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            <BattleLogPanelContent
              layout="desktop"
              viewportRef={battleLogViewportRef}
              battleLogNames={vm.battleLogNames}
              battleLogThisTurn={vm.battleLogThisTurn}
              battleLogStartMessage={vm.battleLogStartMessage}
              battleLogTurns={vm.battleLogTurns}
              showPanelTitle={false}
            />
          </div>
          <div
            aria-hidden={selectedSisterView !== 'turnPhases'}
            inert={
              (selectedSisterView !== 'turnPhases' ? '' : undefined) as unknown as boolean | undefined
            }
            className={`absolute inset-0 flex min-h-0 flex-col ${
              selectedSisterView === 'turnPhases' ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            <LeftRailScrollArea outerClassName="basis-0 flex-1 px-[18px] py-[14px]">
              <TurnPhaseList vm={turnPhases} presentation={turnPhasePresentation} />
            </LeftRailScrollArea>
          </div>
          {showWinStreak ? (
            <div
              aria-hidden={selectedSisterView !== 'winStreak'}
              inert={
                (selectedSisterView !== 'winStreak' ? '' : undefined) as unknown as boolean | undefined
              }
              className={`absolute inset-0 flex min-h-0 flex-col ${
                selectedSisterView === 'winStreak' ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              <LeftRailScrollArea outerClassName="basis-0 flex-1 px-[18px] py-[14px]">
                <WinStreakPanelContent
                  vm={winStreak}
                  canReset={canSubmitInGameWinStreakReset(winStreak, canResign)}
                  onReset={getInGameWinStreakResetAction(actions)}
                  onRetryRecovery={actions.onRetryWinStreakReset}
                />
              </LeftRailScrollArea>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
