/**
 * Viewer seat derivation
 *
 * Centralizes client-runtime identity, stable p1/p2 seats, viewer mode,
 * player-relative aliases, and readiness keys.
 */

import { getPlayers, getPlayerUsers } from './selectors';
import type { ViewerMode, ViewerSeatModel } from './types';

function matchesSessionId(participant: any, sessionId: string | null): boolean {
  return Boolean(
    sessionId &&
      participant &&
      (participant.id === sessionId || participant.sessionId === sessionId)
  );
}

function getReadyKey(participant: any): string | null {
  return participant?.playerId ?? participant?.id ?? null;
}

export function deriveViewerSeats(rawState: any, sessionId: string | null): ViewerSeatModel {
  const allPlayers = getPlayers(rawState);
  const playerUsers = getPlayerUsers(rawState);

  const p1 = playerUsers[0] ?? null;
  const p2 = playerUsers[1] ?? null;
  const viewerParticipant = sessionId
    ? allPlayers.find((participant: any) => matchesSessionId(participant, sessionId)) ?? null
    : null;

  let viewerMode: ViewerMode = 'unknown';
  let me: any | null = null;
  let opponent: any | null = null;

  if (viewerParticipant?.role === 'spectator') {
    viewerMode = 'spectator';
    me = viewerParticipant;
  } else if (viewerParticipant === p1) {
    viewerMode = 'p1_player';
    me = p1;
    opponent = p2;
  } else if (viewerParticipant === p2) {
    viewerMode = 'p2_player';
    me = p2;
    opponent = p1;
  }

  const isViewerPlayer = viewerMode === 'p1_player' || viewerMode === 'p2_player';
  const isViewerSpectator = viewerMode === 'spectator';

  return {
    allPlayers,
    playerUsers,
    viewerMode,
    isViewerPlayer,
    isViewerSpectator,
    p1,
    p2,
    viewerParticipant,
    me,
    opponent,
    p1ReadyKey: getReadyKey(p1),
    p2ReadyKey: getReadyKey(p2),
    meReadyKey: isViewerPlayer ? getReadyKey(me) : null,
    opponentReadyKey: isViewerPlayer ? getReadyKey(opponent) : null,
  };
}
