import { getShipById } from "../../engine_shared/defs/ShipDefinitions.core.ts";
import { recordThirdSpiralFirstStrikeEligibility } from "../../engine_shared/resolve/thirdSpiralFirstStrikeEligibility.ts";
import type {
  ShipInstance,
  ShipPermanentConfiguration,
} from "../state/GameStateTypes.ts";
import {
  createBattleLogBuildManualCaptureEvent,
  createBattleLogBuildProducedCaptureEvent,
} from "../state/battleLogHistory.ts";

export type DrawingWorkingFleetEntry = {
  instanceId: string;
  shipDefId: string;
  chargesCurrent: number;
  createdTurn?: number;
};

export type DrawingShipCreationSource =
  | { kind: "manual" }
  | { kind: "produced"; sourceShipDefId: string };

export type ImmediateDrawingBuiltConsequences = {
  joiningLinesGranted: number;
  producedShipDefIds: string[];
};

export type ImmediateDrawingBuiltConsequencePolicy = {
  producedShips?: "apply" | "suppress";
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0;
}

function isValidSelectedNumber(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 &&
    (value as number) <= 6;
}

function ensureShipsContainer(state: any, playerId: string): ShipInstance[] {
  if (!state.gameData) state.gameData = {};
  if (!state.gameData.ships) state.gameData.ships = {};
  if (!Array.isArray(state.gameData.ships[playerId])) {
    state.gameData.ships[playerId] = [];
  }
  return state.gameData.ships[playerId];
}

function findShipByInstanceId(
  state: Readonly<any>,
  instanceId: string,
): ShipInstance | null {
  const shipsByPlayerId = state?.gameData?.ships;
  if (!shipsByPlayerId || typeof shipsByPlayerId !== "object") return null;
  for (const fleet of Object.values(shipsByPlayerId)) {
    if (!Array.isArray(fleet)) continue;
    const ship = fleet.find((candidate: any) =>
      candidate?.instanceId === instanceId
    );
    if (ship) return ship as ShipInstance;
  }
  return null;
}

function incrementShipsMadeThisTurn(
  state: any,
  playerId: string,
): void {
  if (!state.gameData) state.gameData = {};
  if (!state.gameData.turnData) state.gameData.turnData = {};
  const current = state.gameData.turnData.shipsMadeThisTurnByPlayerId ?? {};
  state.gameData.turnData.shipsMadeThisTurnByPlayerId = {
    ...current,
    [playerId]: (current[playerId] ?? 0) + 1,
  };
}

function normalizeWorkingFleetCharges(ship: ShipInstance): number {
  if (isNonNegativeInteger(ship.chargesCurrent)) return ship.chargesCurrent;
  const definition = getShipById(ship.shipDefId);
  return isNonNegativeInteger(definition?.charges) ? definition.charges : 0;
}

export function getImmediateDrawingBuiltConsequences(
  shipDefId: string,
  policy: ImmediateDrawingBuiltConsequencePolicy = {},
): ImmediateDrawingBuiltConsequences {
  let consequences: ImmediateDrawingBuiltConsequences;
  switch (shipDefId) {
    case "LEG":
      consequences = { joiningLinesGranted: 4, producedShipDefIds: [] };
      break;
    case "ZEN":
      consequences = {
        joiningLinesGranted: 0,
        producedShipDefIds: ["ANT"],
      };
      break;
    default:
      consequences = { joiningLinesGranted: 0, producedShipDefIds: [] };
  }
  return policy.producedShips === "suppress"
    ? { ...consequences, producedShipDefIds: [] }
    : consequences;
}

export function createShipDuringDrawing(args: {
  state: any;
  playerId: string;
  shipDefId: string;
  turnNumber: number;
  creationSource: DrawingShipCreationSource;
  workingFleet?: DrawingWorkingFleetEntry[];
  instanceId?: string;
  chargesOverride?: number;
  permanentConfiguration?: ShipPermanentConfiguration;
  countAsCreatedShip?: boolean;
}): { ship: ShipInstance; events: any[] } {
  const definition = getShipById(args.shipDefId);
  if (!definition) {
    throw new Error(`Unknown Drawing ship definition: ${args.shipDefId}`);
  }
  if (
    typeof args.chargesOverride !== "undefined" &&
    !isNonNegativeInteger(args.chargesOverride)
  ) {
    throw new Error(`Invalid Drawing charge override for ${args.shipDefId}`);
  }

  const selectedNumber = args.permanentConfiguration?.selectedNumber;
  if (
    typeof selectedNumber !== "undefined" &&
    !isValidSelectedNumber(selectedNumber)
  ) {
    throw new Error(
      `Invalid Drawing permanent configuration for ${args.shipDefId}`,
    );
  }

  const instanceId = args.instanceId ?? crypto.randomUUID();
  if (!isNonEmptyString(instanceId)) {
    throw new Error(`Invalid Drawing instance ID for ${args.shipDefId}`);
  }
  if (findShipByInstanceId(args.state, instanceId)) {
    throw new Error(`Drawing ship instance ID collision: ${instanceId}`);
  }

  const fleet = ensureShipsContainer(args.state, args.playerId);
  const controlledSpiralCountBeforeCreation = args.shipDefId === "SPI"
    ? fleet.filter((ship) => ship.shipDefId === "SPI").length
    : 0;
  const ship: ShipInstance = {
    instanceId,
    shipDefId: args.shipDefId,
    createdTurn: args.turnNumber,
  };

  if (typeof args.chargesOverride !== "undefined") {
    ship.chargesCurrent = args.chargesOverride;
  } else if (isNonNegativeInteger(definition.charges)) {
    ship.chargesCurrent = definition.charges;
  }
  if (typeof selectedNumber !== "undefined") {
    ship.permanentConfiguration = structuredClone({ selectedNumber });
  }

  fleet.push(ship);
  args.workingFleet?.push({
    instanceId: ship.instanceId,
    shipDefId: ship.shipDefId,
    chargesCurrent: normalizeWorkingFleetCharges(ship),
    createdTurn: ship.createdTurn,
  });

  if (ship.shipDefId === "SPI") {
    recordThirdSpiralFirstStrikeEligibility({
      state: args.state,
      playerId: args.playerId,
      sourceInstanceId: ship.instanceId,
      turnNumber: args.turnNumber,
      controlledSpiralCountBeforeCreation,
    });
  }
  if (args.countAsCreatedShip !== false) {
    incrementShipsMadeThisTurn(args.state, args.playerId);
  }

  const event = args.creationSource.kind === "manual"
    ? createBattleLogBuildManualCaptureEvent({
      turnNumber: args.turnNumber,
      playerId: args.playerId,
      shipDefId: ship.shipDefId,
    })
    : createBattleLogBuildProducedCaptureEvent({
      turnNumber: args.turnNumber,
      playerId: args.playerId,
      shipDefId: ship.shipDefId,
      sourceShipDefId: args.creationSource.sourceShipDefId,
    });

  return { ship, events: [event] };
}

export function applyImmediateDrawingBuiltConsequences(args: {
  state: any;
  playerId: string;
  builtShip: ShipInstance;
  turnNumber: number;
  workingFleet?: DrawingWorkingFleetEntry[];
  grantJoiningLines: (amount: number) => void;
  producedInstanceIds?: string[];
  consequencePolicy?: ImmediateDrawingBuiltConsequencePolicy;
}): {
  joiningLinesGranted: number;
  producedShips: ShipInstance[];
  events: any[];
} {
  const consequences = getImmediateDrawingBuiltConsequences(
    args.builtShip.shipDefId,
    args.consequencePolicy,
  );
  if (
    args.producedInstanceIds &&
    args.producedInstanceIds.length !== consequences.producedShipDefIds.length
  ) {
    throw new Error(
      `Drawing produced-instance count mismatch for ${args.builtShip.shipDefId}`,
    );
  }

  if (consequences.joiningLinesGranted > 0) {
    args.grantJoiningLines(consequences.joiningLinesGranted);
  }

  const producedShips: ShipInstance[] = [];
  const events: any[] = [];
  for (
    let index = 0;
    index < consequences.producedShipDefIds.length;
    index += 1
  ) {
    const produced = createShipDuringDrawing({
      state: args.state,
      playerId: args.playerId,
      shipDefId: consequences.producedShipDefIds[index],
      turnNumber: args.turnNumber,
      creationSource: {
        kind: "produced",
        sourceShipDefId: args.builtShip.shipDefId,
      },
      workingFleet: args.workingFleet,
      instanceId: args.producedInstanceIds?.[index],
    });
    producedShips.push(produced.ship);
    events.push(...produced.events);
  }

  return {
    joiningLinesGranted: consequences.joiningLinesGranted,
    producedShips,
    events,
  };
}
