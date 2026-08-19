import type { ShipDefId } from '../../../types/ShipTypes.engine';
import type {
  MissionChallengeViewModel,
  MissionResultAutoOpenRequest,
} from '../types';

export interface NormalizedMissionChallenge {
  mission: {
    id: string;
    year: number;
    title: string;
    location: string;
    author: string;
    paragraphs: string[];
    findingIds: string[];
  };
  challenge: {
    shipDefId: ShipDefId;
    condition: 'with' | 'without';
  };
  introPending: boolean;
  result: {
    missionSucceeded: boolean;
    fleetConditionMet: boolean;
    challengeSucceeded: boolean;
  } | null;
}

export interface MissionAutoAckState {
  gameId: string | null;
  eligible: boolean;
  autoAttempted: boolean;
  automaticAttemptSettled: boolean;
  inFlight: boolean;
}

export interface MissionResultAutoPresentationState {
  gameId: string | null;
  missionId: string | null;
  matchedPresentationKey: string | null;
  presentationCleared: boolean;
  request: MissionResultAutoOpenRequest | null;
}

export interface MissionResultAutoPresentationSnapshot {
  gameId: string | null;
  missionId: string | null;
  liveTerminalTriggerPresentationKey: string | null;
  activeHealthPresentationKey: string | null;
  healthResolutionPresentationActive: boolean;
  isFinished: boolean;
  isPlayerViewer: boolean;
  minimizeMissionsThisSession: boolean;
  hasResult: boolean;
  findingCompletionHandled: boolean;
  loreUnlocked: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeFindingIds(value: unknown): string[] | null {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    !value.every(isNonEmptyString)
  ) {
    return null;
  }
  return Array.from(new Set(value));
}

function normalizeResult(value: unknown): NormalizedMissionChallenge['result'] {
  if (!isRecord(value)) return null;
  if (
    typeof value.missionSucceeded !== 'boolean' ||
    typeof value.fleetConditionMet !== 'boolean' ||
    typeof value.challengeSucceeded !== 'boolean'
  ) {
    return null;
  }

  return {
    missionSucceeded: value.missionSucceeded,
    fleetConditionMet: value.fleetConditionMet,
    challengeSucceeded: value.challengeSucceeded,
  };
}

export function normalizeRequesterMissionChallenge(
  state: unknown,
): NormalizedMissionChallenge | null {
  if (!isRecord(state)) return null;
  const requester = state.requester;
  if (!isRecord(requester)) return null;
  const raw = requester.missionChallenge;
  if (!isRecord(raw) || !isRecord(raw.mission) || !isRecord(raw.challenge)) {
    return null;
  }

  const mission = raw.mission;
  const challenge = raw.challenge;
  const findingIds = normalizeFindingIds(mission.findingIds);
  if (
    !isNonEmptyString(mission.id) ||
    typeof mission.year !== 'number' ||
    !Number.isFinite(mission.year) ||
    !Number.isInteger(mission.year) ||
    !isNonEmptyString(mission.title) ||
    !isNonEmptyString(mission.location) ||
    typeof mission.author !== 'string' ||
    !Array.isArray(mission.paragraphs) ||
    !mission.paragraphs.every((paragraph) => typeof paragraph === 'string') ||
    findingIds === null ||
    !isNonEmptyString(challenge.shipDefId) ||
    (challenge.condition !== 'with' && challenge.condition !== 'without') ||
    typeof raw.introPending !== 'boolean'
  ) {
    return null;
  }

  return {
    mission: {
      id: mission.id,
      year: mission.year,
      title: mission.title,
      location: mission.location,
      author: mission.author,
      paragraphs: [...mission.paragraphs],
      findingIds,
    },
    challenge: {
      shipDefId: challenge.shipDefId as ShipDefId,
      condition: challenge.condition,
    },
    introPending: raw.introPending,
    result: Object.prototype.hasOwnProperty.call(raw, 'result')
      ? normalizeResult(raw.result)
      : null,
  };
}

export function buildMissionChallengeViewModel(args: {
  normalized: NormalizedMissionChallenge | null;
  isFinished: boolean;
  isIntroAcknowledgementPending: boolean;
  minimizeMissionsThisSession: boolean;
  shouldPresentInitialIntro: boolean;
  postgameResultAutoOpenRequest: MissionResultAutoOpenRequest | null;
}): MissionChallengeViewModel | null {
  if (!args.normalized) return null;
  return {
    mission: {
      ...args.normalized.mission,
      paragraphs: [...args.normalized.mission.paragraphs],
      findingIds: [...args.normalized.mission.findingIds],
    },
    challenge: { ...args.normalized.challenge },
    introPending: args.normalized.introPending,
    isIntroAcknowledgementPending: args.isIntroAcknowledgementPending,
    shouldPresentInitialIntro: args.shouldPresentInitialIntro,
    isFinished: args.isFinished,
    result: args.normalized.result ? { ...args.normalized.result } : null,
    minimizeMissionsThisSession: args.minimizeMissionsThisSession,
    postgameResultAutoOpenRequest:
      args.postgameResultAutoOpenRequest,
  };
}

export function getCompletedMissionFindingIds(
  missionChallenge: NormalizedMissionChallenge | null,
): string[] {
  return missionChallenge?.result?.missionSucceeded === true
    ? [...missionChallenge.mission.findingIds]
    : [];
}

export function getCompletedMissionId(
  missionChallenge: NormalizedMissionChallenge | null,
): string | null {
  return missionChallenge?.result?.missionSucceeded === true
    ? missionChallenge.mission.id
    : null;
}

export function createMissionResultAutoPresentationState(
  gameId: string | null,
  missionId: string | null,
): MissionResultAutoPresentationState {
  return {
    gameId,
    missionId,
    matchedPresentationKey: null,
    presentationCleared: false,
    request: null,
  };
}

export function advanceMissionResultAutoPresentation(
  state: MissionResultAutoPresentationState,
  snapshot: MissionResultAutoPresentationSnapshot,
): MissionResultAutoPresentationState {
  let next = state;

  if (
    state.gameId !== snapshot.gameId ||
    state.missionId !== snapshot.missionId
  ) {
    next = createMissionResultAutoPresentationState(
      snapshot.gameId,
      snapshot.missionId,
    );
  }

  if (
    snapshot.gameId === null ||
    snapshot.missionId === null ||
    !snapshot.isPlayerViewer ||
    snapshot.minimizeMissionsThisSession
  ) {
    if (
      next.matchedPresentationKey === null &&
      !next.presentationCleared &&
      next.request === null
    ) {
      return next;
    }
    return createMissionResultAutoPresentationState(
      snapshot.gameId,
      snapshot.missionId,
    );
  }

  if (next.request !== null) {
    return next;
  }

  if (
    next.matchedPresentationKey === null &&
    snapshot.liveTerminalTriggerPresentationKey !== null &&
    snapshot.activeHealthPresentationKey ===
      snapshot.liveTerminalTriggerPresentationKey
  ) {
    next = {
      ...next,
      matchedPresentationKey: snapshot.liveTerminalTriggerPresentationKey,
      presentationCleared: false,
    };
  }

  if (
    next.matchedPresentationKey !== null &&
    !next.presentationCleared &&
    !snapshot.healthResolutionPresentationActive
  ) {
    next = { ...next, presentationCleared: true };
  }

  if (
    next.matchedPresentationKey === null ||
    !next.presentationCleared ||
    !snapshot.isFinished ||
    !snapshot.hasResult ||
    !snapshot.findingCompletionHandled
  ) {
    return next;
  }

  return {
    ...next,
    matchedPresentationKey: null,
    presentationCleared: false,
    request: {
      key: `${next.matchedPresentationKey}\u0000${snapshot.missionId}\u0000result`,
      loreUnlocked: snapshot.loreUnlocked,
    },
  };
}

export function consumeMissionResultAutoPresentationRequest(
  state: MissionResultAutoPresentationState,
  requestKey: string,
): MissionResultAutoPresentationState {
  return state.request?.key === requestKey
    ? { ...state, request: null }
    : state;
}

export function createMissionAutoAckState(
  gameId: string | null,
  eligible: boolean,
): MissionAutoAckState {
  return {
    gameId,
    eligible,
    autoAttempted: false,
    automaticAttemptSettled: false,
    inFlight: false,
  };
}

export function shouldPresentInitialMissionIntro(args: {
  state: MissionAutoAckState;
  gameId: string | null;
  missionChallenge: NormalizedMissionChallenge | null;
}): boolean {
  if (
    args.gameId === null ||
    args.state.gameId !== args.gameId ||
    args.missionChallenge?.introPending !== true
  ) {
    return false;
  }

  if (!args.state.eligible) {
    return true;
  }

  return args.state.autoAttempted && args.state.automaticAttemptSettled;
}

export function shouldAutomaticallyAcknowledgeMission(args: {
  state: MissionAutoAckState;
  gameId: string | null;
  missionChallenge: NormalizedMissionChallenge | null;
}): boolean {
  return (
    args.gameId !== null &&
    args.state.gameId === args.gameId &&
    args.state.eligible &&
    !args.state.autoAttempted &&
    !args.state.inFlight &&
    args.missionChallenge?.introPending === true
  );
}

export function claimMissionAcknowledgement(args: {
  state: MissionAutoAckState;
  gameId: string;
  missionChallenge: NormalizedMissionChallenge | null;
  source: 'manual' | 'automatic';
}): MissionAutoAckState | null {
  if (
    args.state.gameId !== args.gameId ||
    args.state.inFlight ||
    args.missionChallenge?.introPending !== true
  ) {
    return null;
  }

  if (
    args.source === 'automatic' &&
    !shouldAutomaticallyAcknowledgeMission({
      state: args.state,
      gameId: args.gameId,
      missionChallenge: args.missionChallenge,
    })
  ) {
    return null;
  }

  return {
    ...args.state,
    autoAttempted:
      args.source === 'automatic' ? true : args.state.autoAttempted,
    automaticAttemptSettled:
      args.source === 'automatic'
        ? false
        : args.state.automaticAttemptSettled,
    inFlight: true,
  };
}
