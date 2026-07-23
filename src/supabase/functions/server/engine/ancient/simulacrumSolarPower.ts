import type {
  AncientPendingSimulacrumCopy,
  AncientSimulacrumMaterializationOutcome,
  GameState,
  ShipInstance,
  ShipPermanentConfiguration,
} from "../state/GameStateTypes.ts";
import { getShipById } from "../../engine_shared/defs/ShipDefinitions.core.ts";
import { isCanonicalBasicOnlyTargetShip } from "../../engine_shared/resolve/destroyRules.ts";
import {
  applyImmediateDrawingBuiltConsequences,
  createShipDuringDrawing,
  getImmediateDrawingBuiltConsequences,
} from "../intent/drawingShipCreation.ts";
import type { ManualSolarResolverDescriptor } from "./manualSolarDeclaration.ts";

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

function getActivePlayerIds(state: Readonly<any>): string[] {
  return Array.isArray(state?.players)
    ? state.players
      .filter((player: any) =>
        player?.role === "player" && isNonEmptyString(player?.id)
      )
      .map((player: any) => player.id)
    : [];
}

function requireOpponentPlayerId(
  state: Readonly<any>,
  playerId: string,
): string {
  const activePlayerIds = getActivePlayerIds(state);
  if (
    activePlayerIds.length !== 2 ||
    !activePlayerIds.includes(playerId)
  ) {
    throw new Error("Simulacrum requires exactly two active player seats");
  }
  return activePlayerIds.find((candidate) => candidate !== playerId)!;
}

function getFleet(state: Readonly<any>, playerId: string): readonly ShipInstance[] {
  const fleet = state?.gameData?.ships?.[playerId];
  return Array.isArray(fleet) ? fleet : [];
}

function findFleetShipByInstanceId(
  state: Readonly<any>,
  instanceId: string,
): { ownerPlayerId: string; ship: ShipInstance } | null {
  const shipsByPlayerId = state?.gameData?.ships;
  if (!shipsByPlayerId || typeof shipsByPlayerId !== "object") return null;
  for (const [ownerPlayerId, fleet] of Object.entries(shipsByPlayerId)) {
    if (!Array.isArray(fleet)) continue;
    const ship = fleet.find((candidate: any) =>
      candidate?.instanceId === instanceId
    );
    if (ship) return { ownerPlayerId, ship: ship as ShipInstance };
  }
  return null;
}

function isChargeCapableDefinition(definition: any): boolean {
  return typeof definition?.charges === "number" &&
    Number.isFinite(definition.charges);
}

function capturePermanentConfiguration(
  ship: Readonly<ShipInstance>,
): ShipPermanentConfiguration {
  const selectedNumber = ship.permanentConfiguration?.selectedNumber;
  if (typeof selectedNumber === "undefined") return {};
  if (!isValidSelectedNumber(selectedNumber)) {
    throw new Error("Simulacrum target has invalid selectedNumber");
  }
  return structuredClone({ selectedNumber });
}

function queuedRecordAlreadyHasFleetShip(
  state: Readonly<any>,
  record: Readonly<AncientPendingSimulacrumCopy>,
): boolean {
  if (!isNonEmptyString(record.materializedInstanceId)) return false;
  const existing = findFleetShipByInstanceId(
    state,
    record.materializedInstanceId,
  );
  return existing?.ownerPlayerId === record.ownerPlayerId &&
    existing.ship.shipDefId === record.copiedShipDefId;
}

export function assertSimulacrumQuantityAvailable(args: {
  state: Readonly<any>;
  ownerPlayerId: string;
  copiedShipDefId: string;
  proposedCount: number;
}): void {
  if (!isNonNegativeInteger(args.proposedCount)) {
    throw new Error("Simulacrum proposed quantity must be a non-negative integer");
  }
  const definition = getShipById(args.copiedShipDefId);
  if (!definition) {
    throw new Error(`Unknown Simulacrum ship definition: ${args.copiedShipDefId}`);
  }
  if (typeof definition.maxQuantity !== "number") return;
  if (
    !Number.isFinite(definition.maxQuantity) ||
    !Number.isInteger(definition.maxQuantity) ||
    definition.maxQuantity < 1
  ) {
    throw new Error(
      `Invalid canonical maximum quantity for ${args.copiedShipDefId}`,
    );
  }

  const currentFleetCount = getFleet(args.state, args.ownerPlayerId).filter(
    (ship) => ship.shipDefId === args.copiedShipDefId,
  ).length;
  const pendingCopies =
    args.state?.gameData?.ancient?.pendingSimulacrumCopies;
  const queuedCount = Array.isArray(pendingCopies)
    ? pendingCopies.filter((record: AncientPendingSimulacrumCopy) =>
      record?.status === "queued" &&
      record.ownerPlayerId === args.ownerPlayerId &&
      record.copiedShipDefId === args.copiedShipDefId &&
      !queuedRecordAlreadyHasFleetShip(args.state, record)
    ).length
    : 0;

  if (
    currentFleetCount + queuedCount + args.proposedCount >
      definition.maxQuantity
  ) {
    throw new Error(
      `Simulacrum would exceed canonical maximum quantity for ${args.copiedShipDefId}`,
    );
  }
}

function requireSimulacrumTarget(context: Parameters<
  ManualSolarResolverDescriptor["resolve"]
>[0]): {
  targetPlayerId: string;
  target: ShipInstance;
  definition: NonNullable<ReturnType<typeof getShipById>>;
} {
  const targetInstanceId = context.cast.targetInstanceId;
  if (!isNonEmptyString(targetInstanceId)) {
    throw new Error("Simulacrum requires targetInstanceId");
  }
  const targetPlayerId = requireOpponentPlayerId(
    context.state,
    context.playerId,
  );
  const snapshot =
    context.state?.gameData?.turnData
      ?.chargeDeclarationFleetSnapshotByPlayerId?.[targetPlayerId];
  const target = Array.isArray(snapshot)
    ? snapshot.find((ship: ShipInstance) =>
      ship?.instanceId === targetInstanceId
    )
    : undefined;
  if (!target) {
    throw new Error(`Illegal Simulacrum target: ${targetInstanceId}`);
  }
  const definition = getShipById(target.shipDefId);
  if (!definition) {
    throw new Error(`Unknown Simulacrum ship definition: ${target.shipDefId}`);
  }
  if (
    !isCanonicalBasicOnlyTargetShip(target.shipDefId) ||
    target.shipDefId === "CUB"
  ) {
    throw new Error(`Illegal Simulacrum target definition: ${target.shipDefId}`);
  }
  if (
    typeof definition.totalLineCost !== "number" ||
    !Number.isFinite(definition.totalLineCost) ||
    !Number.isInteger(definition.totalLineCost) ||
    definition.totalLineCost <= 0
  ) {
    throw new Error(
      `Invalid canonical Simulacrum cost for ${target.shipDefId}`,
    );
  }
  return { targetPlayerId, target, definition };
}

export const SIMULACRUM_SOLAR_RESOLVER: ManualSolarResolverDescriptor = {
  acceptedFields: { targetInstanceId: true },
  resolve(context) {
    if (context.sourceMode !== "manual") {
      throw new Error(
        "Simulacrum may only be resolved from a manual Solar cast",
      );
    }
    const { targetPlayerId, target, definition } = requireSimulacrumTarget(
      context,
    );
    const candidateState = structuredClone(context.state);
    const ancient = candidateState?.gameData?.ancient;
    if (!ancient || !Array.isArray(ancient.pendingSimulacrumCopies)) {
      throw new Error("Simulacrum requires initialized Ancient pending state");
    }

    const duplicatePrimary = ancient.pendingSimulacrumCopies.some(
      (record: AncientPendingSimulacrumCopy) =>
        record.ownerPlayerId === context.playerId &&
        record.queuedTurnNumber === context.battleTurnNumber &&
        record.sourceTargetInstanceId === target.instanceId &&
        record.sourceMode === "primary",
    );
    if (duplicatePrimary) {
      throw new Error(
        `Simulacrum primary target already selected: ${target.instanceId}`,
      );
    }

    assertSimulacrumQuantityAvailable({
      state: candidateState,
      ownerPlayerId: context.playerId,
      copiedShipDefId: target.shipDefId,
      proposedCount: 1,
    });

    const pendingCopyId =
      `${context.castIdentity}:simulacrum-copy:primary`;
    if (
      ancient.pendingSimulacrumCopies.some(
        (record: AncientPendingSimulacrumCopy) =>
          record.pendingCopyId === pendingCopyId,
      )
    ) {
      throw new Error(
        `Duplicate Simulacrum pendingCopyId invariant: ${pendingCopyId}`,
      );
    }

    let capturedStartOfBattleCharges = 0;
    if (isChargeCapableDefinition(definition)) {
      if (!isNonNegativeInteger(target.chargesCurrent)) {
        throw new Error(
          `Simulacrum target has invalid snapshotted charges: ${target.instanceId}`,
        );
      }
      capturedStartOfBattleCharges = target.chargesCurrent;
    }

    const pendingCopy: AncientPendingSimulacrumCopy = {
      pendingCopyId,
      declarationId: context.declarationId,
      ownerPlayerId: context.playerId,
      sourceTargetInstanceId: target.instanceId,
      copiedShipDefId: target.shipDefId,
      queuedTurnNumber: context.battleTurnNumber,
      materializationTurnNumber: context.battleTurnNumber + 1,
      queueOrder: context.ledgerOrder,
      capturedStartOfBattleCharges,
      permanentConfiguration: capturePermanentConfiguration(target),
      sourceMode: "primary",
      status: "queued",
    };
    ancient.pendingSimulacrumCopies = [
      ...ancient.pendingSimulacrumCopies,
      pendingCopy,
    ];

    return {
      candidateState,
      paidEnergy: {
        green: 0,
        red: 0,
        blue: definition.totalLineCost as number,
      },
      effects: [],
      ledgerMetadata: {
        targets: [{
          playerId: targetPlayerId,
          shipInstanceId: target.instanceId,
        }],
        simulacrum: {
          sourceTargetInstanceId: target.instanceId,
          copiedShipDefId: target.shipDefId,
        },
      },
    };
  },
};

function validateQueuedMaterializationInputs(
  record: Readonly<AncientPendingSimulacrumCopy>,
): NonNullable<ReturnType<typeof getShipById>> {
  const definition = getShipById(record.copiedShipDefId);
  if (
    !definition ||
    !isCanonicalBasicOnlyTargetShip(record.copiedShipDefId) ||
    record.copiedShipDefId === "CUB"
  ) {
    throw new Error(
      `Invalid queued Simulacrum definition: ${record.copiedShipDefId}`,
    );
  }
  if (isChargeCapableDefinition(definition)) {
    if (!isNonNegativeInteger(record.capturedStartOfBattleCharges)) {
      throw new Error(
        `Invalid queued Simulacrum charges: ${record.pendingCopyId}`,
      );
    }
  }
  const selectedNumber = record.permanentConfiguration?.selectedNumber;
  if (typeof selectedNumber !== "undefined") {
    if (
      record.copiedShipDefId !== "QUA" ||
      !isValidSelectedNumber(selectedNumber)
    ) {
      throw new Error(
        `Invalid queued Simulacrum selectedNumber: ${record.pendingCopyId}`,
      );
    }
  }
  return definition;
}

function requireMatchingMaterializedShip(args: {
  state: Readonly<any>;
  instanceId: string;
  ownerPlayerId: string;
  shipDefId: string;
  drawingTurnNumber: number;
  label: string;
}): ShipInstance {
  const existing = findFleetShipByInstanceId(args.state, args.instanceId);
  if (
    !existing ||
    existing.ownerPlayerId !== args.ownerPlayerId ||
    existing.ship.shipDefId !== args.shipDefId ||
    existing.ship.createdTurn !== args.drawingTurnNumber
  ) {
    throw new Error(
      `Simulacrum ${args.label} invariant failed: ${args.instanceId}`,
    );
  }
  return existing.ship;
}

function validateMaterializationOutcome(args: {
  state: Readonly<any>;
  record: Readonly<AncientPendingSimulacrumCopy>;
  drawingTurnNumber: number;
}): AncientSimulacrumMaterializationOutcome {
  const { record } = args;
  if (!isNonEmptyString(record.materializedInstanceId)) {
    throw new Error(
      `Simulacrum completed outcome lacks direct instance ID: ${record.pendingCopyId}`,
    );
  }
  const outcome = record.materializationOutcome;
  const expected = getImmediateDrawingBuiltConsequences(
    record.copiedShipDefId,
  );
  if (
    !outcome ||
    outcome.joiningLinesGranted !== expected.joiningLinesGranted ||
    !Array.isArray(outcome.producedShips) ||
    outcome.producedShips.length !== expected.producedShipDefIds.length
  ) {
    throw new Error(
      `Simulacrum incomplete materialization outcome: ${record.pendingCopyId}`,
    );
  }

  requireMatchingMaterializedShip({
    state: args.state,
    instanceId: record.materializedInstanceId,
    ownerPlayerId: record.ownerPlayerId,
    shipDefId: record.copiedShipDefId,
    drawingTurnNumber: args.drawingTurnNumber,
    label: "direct ship",
  });
  for (let index = 0; index < outcome.producedShips.length; index += 1) {
    const produced = outcome.producedShips[index];
    if (
      !produced ||
      !isNonEmptyString(produced.instanceId) ||
      produced.shipDefId !== expected.producedShipDefIds[index] ||
      produced.sourceShipDefId !== record.copiedShipDefId
    ) {
      throw new Error(
        `Simulacrum dependent outcome mismatch: ${record.pendingCopyId}`,
      );
    }
    requireMatchingMaterializedShip({
      state: args.state,
      instanceId: produced.instanceId,
      ownerPlayerId: record.ownerPlayerId,
      shipDefId: produced.shipDefId,
      drawingTurnNumber: args.drawingTurnNumber,
      label: "dependent ship",
    });
  }
  return structuredClone(outcome);
}

export function materializeQueuedSimulacrumCopiesAtDrawing(
  state: GameState,
  drawingTurnNumber: number,
  nowMs = Date.now(),
  createInstanceId: () => string = () => crypto.randomUUID(),
): { state: GameState; events: any[] } {
  const workingState = structuredClone(state);
  const pendingCopies =
    workingState.gameData.ancient?.pendingSimulacrumCopies;
  if (!Array.isArray(pendingCopies)) {
    throw new Error("Simulacrum materialization requires initialized Ancient state");
  }

  const currentDrawingRecords = pendingCopies.filter((record) =>
    record.materializationTurnNumber === drawingTurnNumber
  );
  const selectedRecords = currentDrawingRecords.filter((record) =>
    record.status === "queued"
  );
  if (currentDrawingRecords.length === 0) {
    return { state: workingState, events: [] };
  }

  const seatIndexByPlayerId = new Map<string, number>();
  getActivePlayerIds(workingState).forEach((playerId, index) =>
    seatIndexByPlayerId.set(playerId, index)
  );
  for (const record of currentDrawingRecords) {
    if (!seatIndexByPlayerId.has(record.ownerPlayerId)) {
      throw new Error(
        `Simulacrum materialization owner is not an active player: ${record.ownerPlayerId}`,
      );
    }
  }

  const capacityKeys = new Set(
    selectedRecords.map((record) =>
      `${record.ownerPlayerId}\u0000${record.copiedShipDefId}`
    ),
  );
  for (const key of capacityKeys) {
    const [ownerPlayerId, copiedShipDefId] = key.split("\u0000");
    try {
      assertSimulacrumQuantityAvailable({
        state: workingState,
        ownerPlayerId,
        copiedShipDefId,
        proposedCount: 0,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Simulacrum materialization capacity invariant failed: ${message}`,
      );
    }
  }

  const orderedRecords = [...currentDrawingRecords].sort((left, right) =>
    seatIndexByPlayerId.get(left.ownerPlayerId)! -
      seatIndexByPlayerId.get(right.ownerPlayerId)! ||
    left.queueOrder - right.queueOrder ||
    left.pendingCopyId.localeCompare(right.pendingCopyId)
  );
  type MaterializationPlan = {
    record: AncientPendingSimulacrumCopy;
    directInstanceId: string;
    producedInstanceIds: string[];
    mode: "create" | "reconcile" | "noop";
  };
  const plans: MaterializationPlan[] = [];
  const plannedInstanceIds = new Set<string>();

  for (const record of orderedRecords) {
    const definition = validateQueuedMaterializationInputs(record);
    const expected = getImmediateDrawingBuiltConsequences(
      record.copiedShipDefId,
    );
    for (const producedShipDefId of expected.producedShipDefIds) {
      if (!getShipById(producedShipDefId)) {
        throw new Error(
          `Unknown Simulacrum dependent definition: ${producedShipDefId}`,
        );
      }
    }

    if (
      record.status === "materialized" &&
      !record.materializationOutcome &&
      expected.joiningLinesGranted === 0 &&
      expected.producedShipDefIds.length === 0 &&
      isNonEmptyString(record.materializedInstanceId)
    ) {
      requireMatchingMaterializedShip({
        state: workingState,
        instanceId: record.materializedInstanceId,
        ownerPlayerId: record.ownerPlayerId,
        shipDefId: record.copiedShipDefId,
        drawingTurnNumber,
        label: "legacy direct ship",
      });
      if (plannedInstanceIds.has(record.materializedInstanceId)) {
        throw new Error(
          `Duplicate Simulacrum materialization outcome ID: ${record.materializedInstanceId}`,
        );
      }
      plans.push({
        record,
        directInstanceId: record.materializedInstanceId,
        producedInstanceIds: [],
        mode: "noop",
      });
      plannedInstanceIds.add(record.materializedInstanceId);
      continue;
    }

    if (record.status === "materialized" || record.materializationOutcome) {
      const outcome = validateMaterializationOutcome({
        state: workingState,
        record,
        drawingTurnNumber,
      });
      const recordedInstanceIds = [
        record.materializedInstanceId!,
        ...outcome.producedShips.map((ship) => ship.instanceId),
      ];
      for (const instanceId of recordedInstanceIds) {
        if (plannedInstanceIds.has(instanceId)) {
          throw new Error(
            `Duplicate Simulacrum materialization outcome ID: ${instanceId}`,
          );
        }
        plannedInstanceIds.add(instanceId);
      }
      plans.push({
        record,
        directInstanceId: record.materializedInstanceId!,
        producedInstanceIds: outcome.producedShips.map((ship) =>
          ship.instanceId
        ),
        mode: record.status === "materialized" ? "noop" : "reconcile",
      });
      continue;
    }

    const directInstanceId = record.materializedInstanceId ??
      createInstanceId();
    const producedInstanceIds = expected.producedShipDefIds.map(() =>
      createInstanceId()
    );
    for (const instanceId of [directInstanceId, ...producedInstanceIds]) {
      if (!isNonEmptyString(instanceId)) {
        throw new Error(
          `Invalid Simulacrum planned instance ID: ${record.pendingCopyId}`,
        );
      }
      if (
        plannedInstanceIds.has(instanceId) ||
        findFleetShipByInstanceId(workingState, instanceId)
      ) {
        throw new Error(
          `Simulacrum materialized instance ID collision: ${instanceId}`,
        );
      }
      plannedInstanceIds.add(instanceId);
    }
    if (
      isChargeCapableDefinition(definition) &&
      !isNonNegativeInteger(record.capturedStartOfBattleCharges)
    ) {
      throw new Error(
        `Invalid queued Simulacrum charges: ${record.pendingCopyId}`,
      );
    }
    plans.push({
      record,
      directInstanceId,
      producedInstanceIds,
      mode: "create",
    });
  }

  const materializedByPendingId = new Map<
    string,
    AncientPendingSimulacrumCopy
  >();
  const events: any[] = [];

  for (const plan of plans) {
    const { record } = plan;
    if (plan.mode === "noop") {
      materializedByPendingId.set(record.pendingCopyId, record);
      continue;
    }
    if (plan.mode === "reconcile") {
      materializedByPendingId.set(record.pendingCopyId, {
        ...record,
        status: "materialized",
      });
      continue;
    }

    const definition = getShipById(record.copiedShipDefId)!;
    const created = createShipDuringDrawing({
      state: workingState,
      playerId: record.ownerPlayerId,
      shipDefId: record.copiedShipDefId,
      turnNumber: drawingTurnNumber,
      creationSource: { kind: "produced", sourceShipDefId: "SSIM" },
      instanceId: plan.directInstanceId,
      ...(isChargeCapableDefinition(definition)
        ? { chargesOverride: record.capturedStartOfBattleCharges }
        : {}),
      permanentConfiguration: record.permanentConfiguration,
    });
    const owner = workingState.players.find((player) =>
      player.id === record.ownerPlayerId
    )!;
    const consequences = applyImmediateDrawingBuiltConsequences({
      state: workingState,
      playerId: record.ownerPlayerId,
      builtShip: created.ship,
      turnNumber: drawingTurnNumber,
      grantJoiningLines(amount) {
        owner.joiningLines = (owner.joiningLines ?? 0) + amount;
      },
      producedInstanceIds: plan.producedInstanceIds,
    });
    const materializationOutcome: AncientSimulacrumMaterializationOutcome = {
      joiningLinesGranted: consequences.joiningLinesGranted,
      producedShips: consequences.producedShips.map((ship) => ({
        instanceId: ship.instanceId,
        shipDefId: ship.shipDefId,
        sourceShipDefId: created.ship.shipDefId,
      })),
    };
    materializedByPendingId.set(record.pendingCopyId, {
      ...record,
      status: "materialized",
      materializedInstanceId: created.ship.instanceId,
      materializationOutcome,
    });
    events.push({
      type: "SIMULACRUM_COPY_MATERIALIZED",
      pendingCopyId: record.pendingCopyId,
      declarationId: record.declarationId,
      playerId: record.ownerPlayerId,
      sourceTargetInstanceId: record.sourceTargetInstanceId,
      shipDefId: record.copiedShipDefId,
      shipInstanceId: created.ship.instanceId,
      sourceMode: record.sourceMode,
      atMs: nowMs,
    });
    events.push(...created.events, ...consequences.events);
  }

  workingState.gameData.ancient!.pendingSimulacrumCopies = pendingCopies.map(
    (record) =>
      materializedByPendingId.has(record.pendingCopyId)
        ? materializedByPendingId.get(record.pendingCopyId) ?? record
        : record,
  );
  return { state: workingState, events };
}

export function pruneCompletedSimulacrumCopiesAtBattleReveal(
  state: GameState,
  battleTurnNumber: number,
): void {
  const ancient = state.gameData.ancient;
  if (!ancient || !Array.isArray(ancient.pendingSimulacrumCopies)) return;
  ancient.pendingSimulacrumCopies = ancient.pendingSimulacrumCopies.filter(
    (record) =>
      record.status !== "materialized" ||
      record.materializationTurnNumber > battleTurnNumber,
  );
}

function getDrawingHiddenIdsByOwner(
  state: Readonly<any>,
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  const phase =
    `${state?.gameData?.currentPhase}.${state?.gameData?.currentSubPhase}`;
  if (phase !== "build.drawing") return result;
  const turnNumber = state?.gameData?.turnNumber ??
    state?.gameData?.turnData?.turnNumber ?? state?.turnNumber;
  const pendingCopies =
    state?.gameData?.ancient?.pendingSimulacrumCopies;
  if (!Array.isArray(pendingCopies)) return result;
  for (const record of pendingCopies as AncientPendingSimulacrumCopy[]) {
    if (
      record.status !== "materialized" ||
      record.materializationTurnNumber !== turnNumber ||
      !isNonEmptyString(record.materializedInstanceId)
    ) {
      continue;
    }
    const ids = result.get(record.ownerPlayerId) ?? new Set<string>();
    ids.add(record.materializedInstanceId);
    for (const produced of record.materializationOutcome?.producedShips ?? []) {
      if (isNonEmptyString(produced.instanceId)) {
        ids.add(produced.instanceId);
      }
    }
    result.set(record.ownerPlayerId, ids);
  }
  return result;
}

export function projectPublicShipsForSimulacrumDrawing(
  state: Readonly<any>,
): Record<string, ShipInstance[]> {
  const hiddenByOwner = getDrawingHiddenIdsByOwner(state);
  const shipsByPlayerId = state?.gameData?.ships;
  if (!shipsByPlayerId || typeof shipsByPlayerId !== "object") return {};
  return Object.fromEntries(
    Object.entries(shipsByPlayerId).map(([ownerPlayerId, fleet]) => {
      const hiddenIds = hiddenByOwner.get(ownerPlayerId) ?? new Set<string>();
      const visibleFleet = Array.isArray(fleet)
        ? fleet.filter((ship: any) => !hiddenIds.has(ship?.instanceId))
        : [];
      return [ownerPlayerId, structuredClone(visibleFleet)];
    }),
  );
}

export function projectRequesterShipsForSimulacrumDrawing(
  state: Readonly<any>,
  requestingParticipantId?: string,
): Record<string, ShipInstance[]> {
  const publicShips = projectPublicShipsForSimulacrumDrawing(state);
  if (!isNonEmptyString(requestingParticipantId)) return publicShips;
  const participant = Array.isArray(state?.players)
    ? state.players.find((candidate: any) =>
      candidate?.id === requestingParticipantId
    )
    : undefined;
  if (participant?.role !== "player") return publicShips;
  const canonicalOwnFleet = getFleet(state, requestingParticipantId);
  return {
    ...publicShips,
    [requestingParticipantId]: canonicalOwnFleet.map((ship) =>
      structuredClone(ship)
    ),
  };
}

export function projectRequesterHiddenDrawingSimulacrumShips(
  state: Readonly<any>,
  requestingParticipantId?: string,
): ShipInstance[] {
  if (!isNonEmptyString(requestingParticipantId)) return [];
  const participant = Array.isArray(state?.players)
    ? state.players.find((candidate: any) =>
      candidate?.id === requestingParticipantId
    )
    : undefined;
  if (participant?.role !== "player") return [];
  const hiddenIds =
    getDrawingHiddenIdsByOwner(state).get(requestingParticipantId) ??
      new Set<string>();
  // This requester field intentionally includes every hidden fleet instance
  // caused by current-turn Simulacrum materialization, including dependents.
  return structuredClone(
    getFleet(state, requestingParticipantId).filter((ship) =>
      hiddenIds.has(ship.instanceId)
    ),
  );
}
