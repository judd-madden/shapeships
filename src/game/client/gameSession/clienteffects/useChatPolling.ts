import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type { GameSessionChatEntry } from '../types';
import type { UntimedPollingMode } from './useUntimedPollingThrottle';
import { normalizeChatEntries } from '../chatEntries';

const CHAT_BASELINE_POLL_MS = 5000;
const CHAT_BURST_POLL_MS = 800;
const CHAT_BURST_WINDOW_MS = 15000;
const UNTIMED_IDLE_CHAT_POLL_MS = 12000;

function getLatestChatEntrySignature(entries: GameSessionChatEntry[]): string {
  if (entries.length <= 0) {
    return 'count:0';
  }

  const latestEntry = entries[entries.length - 1];
  const latestEntryId = typeof latestEntry?.id === 'string' ? latestEntry.id : null;

  if (latestEntryId) {
    return `count:${entries.length}|id:${latestEntryId}`;
  }

  const senderKey =
    latestEntry.type === 'message'
      ? latestEntry.playerId ?? latestEntry.playerName ?? ''
      : latestEntry.type === 'rematch_invite' || latestEntry.type === 'spectator_presence'
        ? latestEntry.playerId ?? latestEntry.playerName ?? ''
        : '';
  const newGameKey =
    latestEntry.type === 'rematch_invite'
      ? latestEntry.newGameId ?? ''
      : '';
  const contentKey =
    latestEntry.type === 'spectator_presence'
      ? latestEntry.presence
      : latestEntry.content;

  return [
    `count:${entries.length}`,
    `type:${latestEntry.type}`,
    `timestamp:${latestEntry.timestamp}`,
    `sender:${senderKey}`,
    `content:${contentKey}`,
    `newGameId:${newGameKey}`,
  ].join('|');
}

export function useChatPolling(args: {
  effectiveGameId: string | null;
  hasJoinedCurrentGame: boolean;
  authenticatedGet: (path: string, timeoutMs?: number) => Promise<Response>;
  setChatEntries: (entries: GameSessionChatEntry[]) => void;
  currentChatGameIdRef: MutableRefObject<string | null>;
  isChatAliveRef: MutableRefObject<boolean>;
  lastChatEntrySignatureRef: MutableRefObject<string | null>;
  hasLoadedChatEntriesRef: MutableRefObject<boolean>;
  chatBurstUntilRef: MutableRefObject<number>;
  chatPollTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  scheduleNextChatPollRef: MutableRefObject<((delayMs?: number) => void) | null>;
  isUntimedAuthoritative: boolean;
  untimedPollingMode: UntimedPollingMode;
}) {
  const {
    effectiveGameId,
    hasJoinedCurrentGame,
    authenticatedGet,
    setChatEntries,
    currentChatGameIdRef,
    isChatAliveRef,
    lastChatEntrySignatureRef,
    hasLoadedChatEntriesRef,
    chatBurstUntilRef,
    chatPollTimerRef,
    scheduleNextChatPollRef,
    isUntimedAuthoritative,
    untimedPollingMode,
  } = args;

  function extendChatBurstWindow(): void {
    chatBurstUntilRef.current = Math.max(
      chatBurstUntilRef.current,
      Date.now() + CHAT_BURST_WINDOW_MS
    );
  }

  function getNextChatPollDelayMs(): number {
    const nextDelayMs = chatBurstUntilRef.current > Date.now()
      ? CHAT_BURST_POLL_MS
      : CHAT_BASELINE_POLL_MS;

    if (isUntimedAuthoritative && untimedPollingMode === 'idle') {
      return Math.max(nextDelayMs, UNTIMED_IDLE_CHAT_POLL_MS);
    }

    return nextDelayMs;
  }

  async function fetchChatOnce(options?: {
    gameIdToFetch?: string | null;
    triggerBurstOnNewTail?: boolean;
  }): Promise<void> {
    const gameIdToFetch = options?.gameIdToFetch ?? effectiveGameId;
    const triggerBurstOnNewTail = options?.triggerBurstOnNewTail === true;

    if (!gameIdToFetch || !hasJoinedCurrentGame) {
      return;
    }

    try {
      const response = await authenticatedGet(`/chat-state/${gameIdToFetch}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[useGameSession] Chat poll error: ${response.status} ${errorText}`);
        return;
      }

      const data = await response.json();

      if (!data.ok || !Array.isArray(data.entries)) {
        return;
      }

      if (!isChatAliveRef.current || currentChatGameIdRef.current !== gameIdToFetch) {
        return;
      }

      const nextEntries = normalizeChatEntries(data.entries);
      const nextTailSignature = getLatestChatEntrySignature(nextEntries);
      const previousTailSignature = lastChatEntrySignatureRef.current;
      const shouldBurstForNewTail =
        triggerBurstOnNewTail &&
        hasLoadedChatEntriesRef.current &&
        previousTailSignature !== null &&
        previousTailSignature !== nextTailSignature;

      setChatEntries(nextEntries);
      lastChatEntrySignatureRef.current = nextTailSignature;
      hasLoadedChatEntriesRef.current = true;

      if (shouldBurstForNewTail) {
        extendChatBurstWindow();
      }
    } catch (err: any) {
      console.warn(`[useGameSession] Chat poll error:`, err.message);
    }
  }

  useEffect(() => {
    if (!effectiveGameId) return;
    if (!hasJoinedCurrentGame) return;
    if (isUntimedAuthoritative && untimedPollingMode === 'hidden') return;

    let mounted = true;

    const clearChatPollTimer = () => {
      if (chatPollTimerRef.current) {
        clearTimeout(chatPollTimerRef.current);
        chatPollTimerRef.current = null;
      }
    };

    const scheduleNextChatPoll = (delayMs = getNextChatPollDelayMs()) => {
      clearChatPollTimer();

      if (!mounted) {
        return;
      }

      if (isUntimedAuthoritative && untimedPollingMode === 'hidden') {
        return;
      }

      chatPollTimerRef.current = setTimeout(() => {
        void pollChat();
      }, delayMs);
    };

    const shouldFetchImmediately =
      !isUntimedAuthoritative ||
      untimedPollingMode === 'active';

    const pollChat = async () => {
      await fetchChatOnce({
        gameIdToFetch: effectiveGameId,
        triggerBurstOnNewTail: true,
      });

      if (mounted) {
        scheduleNextChatPoll();
      }
    };

    scheduleNextChatPollRef.current = scheduleNextChatPoll;
    if (shouldFetchImmediately) {
      void pollChat();
    } else {
      scheduleNextChatPoll();
    }

    return () => {
      mounted = false;
      if (scheduleNextChatPollRef.current === scheduleNextChatPoll) {
        scheduleNextChatPollRef.current = null;
      }
      clearChatPollTimer();
    };
  }, [
    effectiveGameId,
    hasJoinedCurrentGame,
    isUntimedAuthoritative,
    untimedPollingMode,
  ]);

  return {
    extendChatBurstWindow,
    getNextChatPollDelayMs,
    fetchChatOnce,
  };
}
