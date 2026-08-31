import {
  SHIP_DEFINITIONS_CORE_SERVER,
  type ShipDefinitionCore,
} from "../../engine_shared/defs/ShipDefinitions.core.ts";
import type { GameState } from "../state/GameStateTypes.ts";
import {
  getMissionPool,
  getMissionStoryById,
  MISSION_YEAR,
  type MissionOpponentSpecies,
  type MissionSpecies,
} from "./MissionStories.ts";

export type MissionChallengeCondition = "with" | "without";

export type MissionChallengeAssignment = {
  playerId: string;
  missionId: string;
  challenge: {
    shipDefId: string;
    condition: MissionChallengeCondition;
  };
  introPending: boolean;
};

export type MissionChallengeResult = {
  missionSucceeded: boolean;
  challengeSucceeded: boolean;
  fleetConditionMet: boolean;
};

export const MISSION_INTRO_GATE_ENABLED = true;

export const MISSION_ASSIGNMENT_SALTS = {
  mission: "phase15b:mission:v1",
  ancientForeignBranch: "phase15b:ancient-foreign-branch:v1",
  ordinaryChallengeShip: "phase15b:ordinary-challenge-ship:v1",
  ancientOwnChallengeShip: "phase15b:ancient-own-challenge-ship:v1",
  ancientForeignChallengeShip: "phase15b:ancient-foreign-challenge-ship:v1",
  challengeCondition: "phase15b:challenge-condition:v1",
} as const;

const DEFINITION_SPECIES_BY_MISSION_SPECIES: Record<MissionSpecies, string> = {
  human: "Human",
  xenite: "Xenite",
  centaur: "Centaur",
  ancient: "Ancient",
};

export function deterministicHash32(seed: string, salt: string): number {
  const input = `${seed}|${salt}`;
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function deterministicBucket(
  seed: string,
  salt: string,
  bucketCount: number,
): number {
  if (!Number.isInteger(bucketCount) || bucketCount <= 0) {
    throw new Error(`Invalid deterministic bucket count: ${bucketCount}`);
  }
  return deterministicHash32(seed, salt) % bucketCount;
}

function chooseDeterministically<T>(
  values: readonly T[],
  seed: string,
  salt: string,
): T {
  if (values.length === 0) {
    throw new Error(`Cannot choose from an empty deterministic pool (${salt})`);
  }
  return values[deterministicBucket(seed, salt, values.length)];
}

export function isFleetCapableChallengeDefinition(
  definition: ShipDefinitionCore,
): boolean {
  return definition.totalLineCost !== null;
}

export function isAncientForeignChallengeDefinition(
  definition: ShipDefinitionCore,
): boolean {
  return definition.shipType === "Basic" || definition.shipType === "Upgraded";
}

export function getOrdinaryChallengeDefinitions(
  species: MissionSpecies,
): ShipDefinitionCore[] {
  const definitionSpecies = DEFINITION_SPECIES_BY_MISSION_SPECIES[species];
  return SHIP_DEFINITIONS_CORE_SERVER
    .filter((definition) =>
      definition.species === definitionSpecies &&
      isFleetCapableChallengeDefinition(definition)
    )
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function getAncientForeignChallengeDefinitions(
  opponentSpecies: Exclude<MissionOpponentSpecies, "ancient">,
): ShipDefinitionCore[] {
  const definitionSpecies =
    DEFINITION_SPECIES_BY_MISSION_SPECIES[opponentSpecies];
  return SHIP_DEFINITIONS_CORE_SERVER
    .filter((definition) =>
      definition.species === definitionSpecies &&
      isAncientForeignChallengeDefinition(definition)
    )
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id));
}

function isMissionSpecies(value: unknown): value is MissionSpecies {
  return value === "human" || value === "xenite" || value === "centaur" ||
    value === "ancient";
}

function isMissionOpponentSpecies(
  value: unknown,
): value is MissionOpponentSpecies {
  return value === "human" || value === "xenite" || value === "centaur" ||
    value === "ancient";
}

export function createMissionChallengeAssignment(args: {
  gameId: string;
  playerId: string;
  playerSpecies: MissionSpecies;
  opponentSpecies: MissionOpponentSpecies;
  completedMissionIds?: unknown;
}): MissionChallengeAssignment {
  const fullMissionPool = getMissionPool(
    args.playerSpecies,
    args.opponentSpecies,
  );
  const matchupMissionIds = new Set(
    fullMissionPool.map((mission) => mission.id),
  );
  const completedMissionIds = new Set(
    Array.isArray(args.completedMissionIds)
      ? args.completedMissionIds.filter((id): id is string =>
        typeof id === "string" &&
        id.trim().length > 0 &&
        matchupMissionIds.has(id)
      )
      : [],
  );
  const uncompletedMissionPool = fullMissionPool.filter((mission) =>
    !completedMissionIds.has(mission.id)
  );
  const assignmentMissionPool = uncompletedMissionPool.length > 0
    ? uncompletedMissionPool
    : fullMissionPool;
  const mission = chooseDeterministically(
    assignmentMissionPool,
    args.gameId,
    MISSION_ASSIGNMENT_SALTS.mission,
  );

  let challengeDefinition: ShipDefinitionCore;
  let condition: MissionChallengeCondition;

  const useAncientForeignChallenge = args.playerSpecies === "ancient" &&
    args.opponentSpecies !== "ancient" &&
    deterministicBucket(
        args.gameId,
        MISSION_ASSIGNMENT_SALTS.ancientForeignBranch,
        4,
      ) === 0;

  if (useAncientForeignChallenge && args.opponentSpecies !== "ancient") {
    challengeDefinition = chooseDeterministically(
      getAncientForeignChallengeDefinitions(args.opponentSpecies),
      args.gameId,
      MISSION_ASSIGNMENT_SALTS.ancientForeignChallengeShip,
    );
    condition = "with";
  } else {
    challengeDefinition = chooseDeterministically(
      getOrdinaryChallengeDefinitions(args.playerSpecies),
      args.gameId,
      args.playerSpecies === "ancient"
        ? MISSION_ASSIGNMENT_SALTS.ancientOwnChallengeShip
        : MISSION_ASSIGNMENT_SALTS.ordinaryChallengeShip,
    );
    condition = deterministicBucket(
        args.gameId,
        MISSION_ASSIGNMENT_SALTS.challengeCondition,
        2,
      ) === 0
      ? "with"
      : "without";
  }

  return {
    playerId: args.playerId,
    missionId: mission.id,
    challenge: {
      shipDefId: challengeDefinition.id,
      condition,
    },
    introPending: MISSION_INTRO_GATE_ENABLED,
  };
}

export function ensureMissionChallengeAssignment<T extends Record<string, any>>(
  state: T,
  options: { completedMissionIds?: unknown } = {},
): T {
  if (state.missionChallengeAssignment) {
    return state;
  }

  const players = Array.isArray(state.players)
    ? state.players.filter((player: any) => player?.role === "player")
    : [];
  const controllers = state.controllersByPlayerId ?? {};
  const human = players.find((player: any) =>
    controllers[player?.id]?.kind === "human"
  );
  const bot = players.find((player: any) =>
    controllers[player?.id]?.kind === "bot"
  );
  const playerSpecies = human?.faction ?? human?.species;
  const opponentSpecies = bot?.faction ?? bot?.species;

  if (
    typeof state.gameId !== "string" ||
    !human?.id ||
    !bot?.id ||
    !isMissionSpecies(playerSpecies) ||
    !isMissionOpponentSpecies(opponentSpecies)
  ) {
    return state;
  }

  return {
    ...state,
    missionChallengeAssignment: createMissionChallengeAssignment({
      gameId: state.gameId,
      playerId: human.id,
      playerSpecies,
      opponentSpecies,
      completedMissionIds: options.completedMissionIds,
    }),
  };
}

export function evaluateMissionChallengeResult(
  state: Pick<GameState, "status" | "winnerPlayerId" | "gameData">,
  assignment: MissionChallengeAssignment,
): MissionChallengeResult | null {
  if (state.status !== "finished") return null;

  const finalFleet = Array.isArray(state.gameData?.ships?.[assignment.playerId])
    ? state.gameData.ships![assignment.playerId]
    : [];
  const targetPresent = finalFleet.some((ship) =>
    ship?.shipDefId === assignment.challenge.shipDefId
  );
  const fleetConditionMet = assignment.challenge.condition === "with"
    ? targetPresent
    : !targetPresent;
  const missionSucceeded = state.winnerPlayerId === assignment.playerId;

  return {
    missionSucceeded,
    fleetConditionMet,
    challengeSucceeded: missionSucceeded && fleetConditionMet,
  };
}

export function projectMissionChallengeForRequester(
  state: any,
  requestingParticipantId?: string,
) {
  const assignment = state?.missionChallengeAssignment as
    | MissionChallengeAssignment
    | undefined;
  if (!assignment || assignment.playerId !== requestingParticipantId) {
    return null;
  }

  const requester = state?.players?.find(
    (player: any) => player?.id === requestingParticipantId,
  );
  if (
    requester?.role !== "player" ||
    state?.controllersByPlayerId?.[requestingParticipantId]?.kind !== "human"
  ) {
    return null;
  }

  const mission = getMissionStoryById(assignment.missionId);
  if (!mission) return null;

  const result = evaluateMissionChallengeResult(state, assignment);
  return {
    mission: {
      id: mission.id,
      year: MISSION_YEAR,
      title: mission.title,
      location: mission.location,
      author: mission.author,
      paragraphs: [...mission.paragraphs],
      findingIds: [...mission.findingIds],
    },
    challenge: { ...assignment.challenge },
    introPending: MISSION_INTRO_GATE_ENABLED && assignment.introPending,
    ...(result ? { result } : {}),
  };
}

export function stripMissionChallengeAssignment<T>(state: T): T {
  if (!state || typeof state !== "object") return state;
  const {
    missionChallengeAssignment: _omittedMissionChallengeAssignment,
    ...clientSafeState
  } = state as Record<string, unknown>;
  return clientSafeState as T;
}
