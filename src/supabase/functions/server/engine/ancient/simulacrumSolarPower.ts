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

const SIMULACRUM_IMMEDIATE_CONSEQUENCE_POLICY = {
  producedShips: "suppress",
} as const;

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
  if (!isCanonicalBasicOnlyTargetShip(target.shipDefId)) {
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
    if (context.sourceMode === "autocast") {
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

    const pendingSourceMode = "primary";
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
      `${context.castIdentity}:simulacrum-copy:${pendingSourceMode}`;
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
    const permanentConfiguration = capturePermanentConfiguration(target);

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
      permanentConfiguration: structuredClone(permanentConfiguration),
      sourceMode: pendingSourceMode,
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
          capturedStartOfBattleCharges,
          permanentConfiguration: structuredClone(permanentConfiguration),
        },
      },
    };
  },
};

function validateQueuedMaterializationInputs(
  record: Readonly<AncientPendingSimulacrumCopy>,
): NonNullable<ReturnType<typeof getShipById>> {
  const definition = getShipById(record.copiedShipDefId);
  if (!definition || !isCanonicalBasicOnlyTargetShip(record.copiedShipDefId)) {
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
  materializationTurnNumber: number;
  label: string;
}): ShipInstance {
  const existing = findFleetShipByInstanceId(args.state, args.instanceId);
  if (
    !existing ||
    existing.ownerPlayerId !== args.ownerPlayerId ||
    existing.ship.shipDefId !== args.shipDefId ||
    existing.ship.createdTurn !== args.materializationTurnNumber
  ) {
    throw new Error(
      `Simulacrum ${args.label} invariant failed: ${args.instanceId}`,
    );
  }
  return existing.ship;
}

function validateMaterializationSlotOutcome(args: {
  state: Readonly<any>;
  record: Readonly<AncientPendingSimulacrumCopy>;
  materializationTurnNumber: number;
  directInstanceId: unknown;
  outcome: AncientSimulacrumMaterializationOutcome | undefined;
  slot: 1 | 2;
}): AncientSimulacrumMaterializationOutcome {
  const { record } = args;
  if (!isNonEmptyString(args.directInstanceId)) {
    throw new Error(
      `Simulacrum slot ${args.slot} lacks direct instance ID: ${record.pendingCopyId}`,
    );
  }
  const outcome = args.outcome;
  const expected = getImmediateDrawingBuiltConsequences(
    record.copiedShipDefId,
    SIMULACRUM_IMMEDIATE_CONSEQUENCE_POLICY,
  );
  const matchesCurrentExpectation = !!outcome &&
    outcome.joiningLinesGranted === expected.joiningLinesGranted &&
    Array.isArray(outcome.producedShips) &&
    outcome.producedShips.length === expected.producedShipDefIds.length &&
    outcome.producedShips.every((produced, index) =>
      !!produced &&
      isNonEmptyString(produced.instanceId) &&
      produced.shipDefId === expected.producedShipDefIds[index] &&
      produced.sourceShipDefId === record.copiedShipDefId
    );
  const matchesLegacyCopiedZenExpectation = !!outcome &&
    record.copiedShipDefId === "ZEN" &&
    outcome.joiningLinesGranted === 0 &&
    Array.isArray(outcome.producedShips) &&
    outcome.producedShips.length === 1 &&
    isNonEmptyString(outcome.producedShips[0]?.instanceId) &&
    outcome.producedShips[0]?.shipDefId === "ANT" &&
    outcome.producedShips[0]?.sourceShipDefId === "ZEN";
  if (!matchesCurrentExpectation && !matchesLegacyCopiedZenExpectation) {
    throw new Error(
      `Simulacrum incomplete materialization outcome: ${record.pendingCopyId}`,
    );
  }

  requireMatchingMaterializedShip({
    state: args.state,
    instanceId: args.directInstanceId,
    ownerPlayerId: record.ownerPlayerId,
    shipDefId: record.copiedShipDefId,
    materializationTurnNumber: args.materializationTurnNumber,
    label: `slot ${args.slot} direct ship`,
  });
  for (let index = 0; index < outcome!.producedShips.length; index += 1) {
    const produced = outcome!.producedShips[index];
    requireMatchingMaterializedShip({
      state: args.state,
      instanceId: produced.instanceId,
      ownerPlayerId: record.ownerPlayerId,
      shipDefId: produced.shipDefId,
      materializationTurnNumber: args.materializationTurnNumber,
      label: "dependent ship",
    });
  }
  return structuredClone(outcome!);
}

export function materializeQueuedSimulacrumCopiesAtTurnStart(
  state: GameState,
  materializationTurnNumber: number,
  nowMs = Date.now(),
  createInstanceId: () => string = () => crypto.randomUUID(),
): { state: GameState; events: any[] } {
  const workingState = structuredClone(state);
  const pendingCopies =
    workingState.gameData.ancient?.pendingSimulacrumCopies;
  if (!Array.isArray(pendingCopies)) {
    throw new Error("Simulacrum materialization requires initialized Ancient state");
  }

  const currentMaterializationRecords = pendingCopies.filter((record) =>
    record.materializationTurnNumber === materializationTurnNumber
  );
  if (currentMaterializationRecords.length === 0) {
    return { state: workingState, events: [] };
  }

  const seatIndexByPlayerId = new Map<string, number>();
  getActivePlayerIds(workingState).forEach((playerId, index) =>
    seatIndexByPlayerId.set(playerId, index)
  );
  for (const record of currentMaterializationRecords) {
    if (!seatIndexByPlayerId.has(record.ownerPlayerId)) {
      throw new Error(
        `Simulacrum materialization owner is not an active player: ${record.ownerPlayerId}`,
      );
    }
  }

  const orderedRecords = [...currentMaterializationRecords].sort((left, right) =>
    seatIndexByPlayerId.get(left.ownerPlayerId)! -
      seatIndexByPlayerId.get(right.ownerPlayerId)! ||
    left.queueOrder - right.queueOrder ||
    left.pendingCopyId.localeCompare(right.pendingCopyId)
  );
  const chronoswarmQualifiedOwnerIds = new Set(
    getActivePlayerIds(workingState).filter((playerId) =>
      getFleet(workingState, playerId).some((ship) => ship.shipDefId === "CHR")
    ),
  );

  type MaterializationSlotPlan = {
    record: AncientPendingSimulacrumCopy;
    slot: 1 | 2;
    directInstanceId: string;
    producedInstanceIds: string[];
    mode: "create" | "reconcile" | "noop";
  };
  const plans: MaterializationSlotPlan[] = [];
  const plannedInstanceIds = new Set<string>();
  const plannedCreateCountByOwnerAndDefinition = new Map<string, number>();

  for (const record of orderedRecords) {
    const definition = validateQueuedMaterializationInputs(record);
    const expected = getImmediateDrawingBuiltConsequences(
      record.copiedShipDefId,
      SIMULACRUM_IMMEDIATE_CONSEQUENCE_POLICY,
    );
    for (const producedShipDefId of expected.producedShipDefIds) {
      if (!getShipById(producedShipDefId)) {
        throw new Error(
          `Unknown Simulacrum dependent definition: ${producedShipDefId}`,
        );
      }
    }

    const inferredMultiplicity: 1 | 2 =
      record.materializationMultiplicity === 2 ||
        isNonEmptyString(record.repeatedMaterializedInstanceId) ||
        !!record.repeatedMaterializationOutcome
        ? 2
        : record.status === "materialized" || record.materializationMultiplicity === 1
        ? 1
        : chronoswarmQualifiedOwnerIds.has(record.ownerPlayerId)
        ? 2
        : 1;
    const plannedRecord = record.status === "materialized"
      ? record
      : { ...record, materializationMultiplicity: inferredMultiplicity };

    for (let slot = 1; slot <= inferredMultiplicity; slot += 1) {
      const materializationSlot = slot as 1 | 2;
      const recordedDirectInstanceId = materializationSlot === 1
        ? record.materializedInstanceId
        : record.repeatedMaterializedInstanceId;
      const recordedOutcome = materializationSlot === 1
        ? record.materializationOutcome
        : record.repeatedMaterializationOutcome;

      if (
        record.status === "materialized" &&
        !recordedOutcome &&
        expected.joiningLinesGranted === 0 &&
        expected.producedShipDefIds.length === 0 &&
        isNonEmptyString(recordedDirectInstanceId)
      ) {
        requireMatchingMaterializedShip({
          state: workingState,
          instanceId: recordedDirectInstanceId,
          ownerPlayerId: record.ownerPlayerId,
          shipDefId: record.copiedShipDefId,
          materializationTurnNumber,
          label: `legacy slot ${materializationSlot} direct ship`,
        });
        if (plannedInstanceIds.has(recordedDirectInstanceId)) {
          throw new Error(
            `Duplicate Simulacrum materialization outcome ID: ${recordedDirectInstanceId}`,
          );
        }
        plannedInstanceIds.add(recordedDirectInstanceId);
        plans.push({
          record: plannedRecord,
          slot: materializationSlot,
          directInstanceId: recordedDirectInstanceId,
          producedInstanceIds: [],
          mode: "noop",
        });
        continue;
      }

      if (recordedOutcome || record.status === "materialized") {
        const outcome = validateMaterializationSlotOutcome({
          state: workingState,
          record,
          materializationTurnNumber,
          directInstanceId: recordedDirectInstanceId,
          outcome: recordedOutcome,
          slot: materializationSlot,
        });
        const recordedInstanceIds = [
          recordedDirectInstanceId!,
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
          record: plannedRecord,
          slot: materializationSlot,
          directInstanceId: recordedDirectInstanceId!,
          producedInstanceIds: outcome.producedShips.map((ship) => ship.instanceId),
          mode: record.status === "materialized" ? "noop" : "reconcile",
        });
        continue;
      }

      const directInstanceId = recordedDirectInstanceId ?? createInstanceId();
      const producedInstanceIds = expected.producedShipDefIds.map(() => createInstanceId());
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
      for (const shipDefId of [record.copiedShipDefId, ...expected.producedShipDefIds]) {
        const key = `${record.ownerPlayerId}\u0000${shipDefId}`;
        plannedCreateCountByOwnerAndDefinition.set(
          key,
          (plannedCreateCountByOwnerAndDefinition.get(key) ?? 0) + 1,
        );
      }
      plans.push({
        record: plannedRecord,
        slot: materializationSlot,
        directInstanceId,
        producedInstanceIds,
        mode: "create",
      });
    }
  }

  for (const [key, plannedCreateCount] of plannedCreateCountByOwnerAndDefinition) {
    const [ownerPlayerId, shipDefId] = key.split("\u0000");
    const definition = getShipById(shipDefId);
    if (!definition) throw new Error(`Unknown Simulacrum planned definition: ${shipDefId}`);
    if (typeof definition.maxQuantity !== "number") continue;
    const currentCount = getFleet(workingState, ownerPlayerId).filter((ship) =>
      ship.shipDefId === shipDefId
    ).length;
    if (currentCount + plannedCreateCount > definition.maxQuantity) {
      throw new Error(
        `Simulacrum materialization capacity invariant failed: ${shipDefId} would exceed canonical maximum quantity`,
      );
    }
  }

  const materializedByPendingId = new Map<
    string,
    AncientPendingSimulacrumCopy
  >();
  const events: any[] = [];

  for (const plan of plans) {
    const { record } = plan;
    const priorMaterialized = materializedByPendingId.get(record.pendingCopyId) ?? record;
    if (plan.mode === "noop" || plan.mode === "reconcile") {
      materializedByPendingId.set(record.pendingCopyId, {
        ...priorMaterialized,
        ...(record.materializationMultiplicity
          ? { materializationMultiplicity: record.materializationMultiplicity }
          : {}),
        status: "materialized",
      });
      continue;
    }

    const definition = getShipById(record.copiedShipDefId)!;
    const created = createShipDuringDrawing({
      state: workingState,
      playerId: record.ownerPlayerId,
      shipDefId: record.copiedShipDefId,
      turnNumber: materializationTurnNumber,
      creationSource: {
        kind: "produced",
        sourceShipDefId: "SSIM",
        producedBuildOccurrence: { stage: "turn_start_materialisation" },
      },
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
      turnNumber: materializationTurnNumber,
      grantJoiningLines(amount) {
        owner.joiningLines = (owner.joiningLines ?? 0) + amount;
      },
      producedInstanceIds: plan.producedInstanceIds,
      consequencePolicy: SIMULACRUM_IMMEDIATE_CONSEQUENCE_POLICY,
      producedBuildOccurrence: { stage: "turn_start_materialisation" },
    });
    const materializationOutcome: AncientSimulacrumMaterializationOutcome = {
      joiningLinesGranted: consequences.joiningLinesGranted,
      producedShips: consequences.producedShips.map((ship) => ({
        instanceId: ship.instanceId,
        shipDefId: ship.shipDefId,
        sourceShipDefId: created.ship.shipDefId,
      })),
    };
    const materializedRecord: AncientPendingSimulacrumCopy = {
      ...priorMaterialized,
      status: "materialized",
      ...(record.materializationMultiplicity
        ? { materializationMultiplicity: record.materializationMultiplicity }
        : {}),
      ...(plan.slot === 1
        ? {
          materializedInstanceId: created.ship.instanceId,
          materializationOutcome,
        }
        : {
          repeatedMaterializedInstanceId: created.ship.instanceId,
          repeatedMaterializationOutcome: materializationOutcome,
        }),
    };
    materializedByPendingId.set(record.pendingCopyId, materializedRecord);
    events.push({
      type: "SIMULACRUM_COPY_MATERIALIZED",
      pendingCopyId: record.pendingCopyId,
      declarationId: record.declarationId,
      playerId: record.ownerPlayerId,
      sourceTargetInstanceId: record.sourceTargetInstanceId,
      shipDefId: record.copiedShipDefId,
      shipInstanceId: created.ship.instanceId,
      materializationSlot: plan.slot,
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

function getCurrentTurnNumber(state: Readonly<any>): number | null {
  const canonicalGameData = state?.gameData?.ships ? state.gameData : state;
  const value = canonicalGameData?.turnNumber ??
    canonicalGameData?.turnData?.turnNumber ??
    state?.turnNumber;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getCurrentTurnMaterializedRecords(
  state: Readonly<any>,
): AncientPendingSimulacrumCopy[] {
  const turnNumber = getCurrentTurnNumber(state);
  const canonicalGameData = state?.gameData?.ships ? state.gameData : state;
  const pendingCopies = canonicalGameData?.ancient?.pendingSimulacrumCopies;
  if (turnNumber === null || !Array.isArray(pendingCopies)) return [];
  return pendingCopies.filter((record: AncientPendingSimulacrumCopy) =>
    record?.status === "materialized" &&
    record.materializationTurnNumber === turnNumber &&
    isNonEmptyString(record.ownerPlayerId) &&
    isNonEmptyString(record.materializedInstanceId)
  );
}

function createEmptyPlayerIdMap(state: Readonly<any>): Record<string, string[]> {
  return Object.fromEntries(
    getActivePlayerIds(state).map((playerId) => [playerId, []]),
  );
}

export function getDirectMaterializedSimulacrumInstanceIdsForPlayer(
  state: Readonly<any>,
  playerId: string,
): Set<string> {
  return new Set(
    getCurrentTurnMaterializedRecords(state)
      .filter((record) => record.ownerPlayerId === playerId)
      .flatMap((record) => [
        record.materializedInstanceId,
        record.repeatedMaterializedInstanceId,
      ])
      .filter(isNonEmptyString),
  );
}

export function deriveMaterializedSimulacrumFleetInstanceIdsByPlayerId(
  state: Readonly<any>,
): Record<string, string[]> {
  const result = createEmptyPlayerIdMap(state);
  const seenByPlayerId = new Map<string, Set<string>>();
  for (const record of getCurrentTurnMaterializedRecords(state)) {
    const ids = result[record.ownerPlayerId] ?? [];
    const seen = seenByPlayerId.get(record.ownerPlayerId) ?? new Set<string>();
    for (const instanceId of [
      record.materializedInstanceId,
      ...(record.materializationOutcome?.producedShips ?? []).map((ship) =>
        ship.instanceId
      ),
      record.repeatedMaterializedInstanceId,
      ...(record.repeatedMaterializationOutcome?.producedShips ?? []).map((ship) =>
        ship.instanceId
      ),
    ]) {
      if (!isNonEmptyString(instanceId) || seen.has(instanceId)) continue;
      seen.add(instanceId);
      ids.push(instanceId);
    }
    result[record.ownerPlayerId] = ids;
    seenByPlayerId.set(record.ownerPlayerId, seen);
  }
  return result;
}

function ledgerEntryMatchesMaterializedRecord(
  entry: any,
  record: Readonly<AncientPendingSimulacrumCopy>,
): boolean {
  return entry?.solarPowerId === "SSIM" &&
    entry?.sourceMode === "manual" &&
    entry?.order === record.queueOrder &&
    entry?.simulacrum?.copiedShipDefId === record.copiedShipDefId &&
    entry?.simulacrum?.sourceTargetInstanceId ===
      record.sourceTargetInstanceId;
}

export function deriveMaterializedSimulacrumLedgerEntryIdsByPlayerId(
  state: Readonly<any>,
): Record<string, string[]> {
  const result = createEmptyPlayerIdMap(state);
  const recordsByPlayerId = new Map<string, AncientPendingSimulacrumCopy[]>();
  for (const record of getCurrentTurnMaterializedRecords(state)) {
    const records = recordsByPlayerId.get(record.ownerPlayerId) ?? [];
    records.push(record);
    recordsByPlayerId.set(record.ownerPlayerId, records);
  }

  for (const [playerId, records] of recordsByPlayerId) {
    const ledger = state?.gameData?.ancient?.solarLedgerByPlayerId?.[playerId];
    if (!Array.isArray(ledger?.entries)) continue;
    const entries = ledger.entries.filter((entry: any) =>
      isNonEmptyString(entry?.entryId)
    );
    const usedEntryIds = new Set<string>();
    const matchedEntryIds: string[] = [];
    const unmatchedRecords: AncientPendingSimulacrumCopy[] = [];

    for (const record of records) {
      if (ledger.battleTurnNumber !== record.queuedTurnNumber) {
        continue;
      }
      const exact = entries.find((entry: any) =>
        !usedEntryIds.has(entry.entryId) &&
        record.pendingCopyId ===
          `${entry.entryId}:simulacrum-copy:${record.sourceMode}` &&
        ledgerEntryMatchesMaterializedRecord(entry, record)
      );
      if (!exact) {
        unmatchedRecords.push(record);
        continue;
      }
      usedEntryIds.add(exact.entryId);
      matchedEntryIds.push(exact.entryId);
    }

    for (const record of unmatchedRecords) {
      if (ledger.battleTurnNumber !== record.queuedTurnNumber) continue;
      const legacyMatch = entries.find((entry: any) =>
        !usedEntryIds.has(entry.entryId) &&
        ledgerEntryMatchesMaterializedRecord(entry, record)
      );
      if (!legacyMatch) continue;
      usedEntryIds.add(legacyMatch.entryId);
      matchedEntryIds.push(legacyMatch.entryId);
    }

    result[playerId] = matchedEntryIds;
  }

  return result;
}
