import type {
  AncientEnergyPool,
  AncientNormalizedSolarCast,
  AncientSimulacrumPresentation,
  AncientSolarLedgerEntry,
  AncientSolarPowerId,
  AncientSolarSourceMode,
  AncientSolarTargetReference,
  ShipPermanentConfiguration,
} from '../state/GameStateTypes.ts';
import { applyEffects, type EffectEvent } from '../../engine_shared/effects/applyEffects.ts';
import type { Effect } from '../../engine_shared/effects/Effect.ts';

export type ManualSolarResolverDescriptor = {
  acceptedFields: {
    targetInstanceId?: boolean;
    targetInstanceIds?: boolean;
    lockedAmount?: boolean;
  };
  resolve: (context: Readonly<{
    state: Readonly<any>;
    playerId: string;
    declarationId: string;
    battleTurnNumber: number;
    castIndex: number;
    ledgerOrder: number;
    sourceMode: AncientSolarSourceMode;
    castIdentity: string;
    cast: Readonly<AncientNormalizedSolarCast>;
    remainingEnergy: Readonly<AncientEnergyPool>;
  }>) => ManualSolarResolverResult;
};

export type ManualSolarResolverResult = {
  candidateState: any;
  paidEnergy: AncientEnergyPool;
  effects: Effect[];
  ledgerMetadata?: {
    lockedAmount?: number;
    targets?: AncientSolarTargetReference[];
    simulacrum?: AncientSimulacrumPresentation;
  };
};

export type ManualSolarResolverRegistry = Partial<
  Record<AncientSolarPowerId, ManualSolarResolverDescriptor>
>;

export type ManualSolarDeclarationResult = {
  state: any;
  remainingEnergy: AncientEnergyPool;
  acceptedCasts: AncientNormalizedSolarCast[];
  ledgerEntries: AncientSolarLedgerEntry[];
  effects: Effect[];
  effectEvents: EffectEvent[];
};

const ENERGY_COLOURS = ['green', 'red', 'blue'] as const;

function cloneEnergyPool(pool: AncientEnergyPool): AncientEnergyPool {
  return { green: pool.green, red: pool.red, blue: pool.blue };
}

function validateAcceptedFields(
  cast: AncientNormalizedSolarCast,
  descriptor: ManualSolarResolverDescriptor,
): void {
  for (const field of ['targetInstanceId', 'targetInstanceIds', 'lockedAmount'] as const) {
    if (typeof cast[field] !== 'undefined' && descriptor.acceptedFields[field] !== true) {
      throw new Error(`${cast.solarPowerId} does not accept ${field}`);
    }
  }
}

function validatePaidEnergy(value: unknown, solarPowerId: AncientSolarPowerId): AncientEnergyPool {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Solar resolver ${solarPowerId} returned invalid paid Energy`);
  }
  const paid = value as Record<string, unknown>;
  for (const colour of ENERGY_COLOURS) {
    const amount = paid[colour];
    if (typeof amount !== 'number' || !Number.isFinite(amount) || !Number.isInteger(amount) || amount < 0) {
      throw new Error(`Solar resolver ${solarPowerId} returned invalid ${colour} Energy payment`);
    }
  }
  const normalized = paid as AncientEnergyPool;
  if (normalized.green + normalized.red + normalized.blue < 1) {
    throw new Error(`Manual Solar resolver ${solarPowerId} must pay at least one Energy`);
  }
  return normalized;
}

function requireResolverMetadataId(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Solar resolver returned invalid ledger ${field}`);
  }
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateLedgerMetadata(
  value: unknown,
  solarPowerId: AncientSolarPowerId,
): ManualSolarResolverResult['ledgerMetadata'] {
  if (typeof value === 'undefined') return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Solar resolver ${solarPowerId} returned invalid ledger metadata`);
  }
  const metadata = value as Record<string, unknown>;
  const allowedFields = new Set(['lockedAmount', 'targets', 'simulacrum']);
  const unsupportedField = Object.keys(metadata).find((field) => !allowedFields.has(field));
  if (unsupportedField) {
    throw new Error(`Solar resolver ${solarPowerId} returned unsupported ledger metadata: ${unsupportedField}`);
  }

  let lockedAmount: number | undefined;
  if (typeof metadata.lockedAmount !== 'undefined') {
    if (
      typeof metadata.lockedAmount !== 'number' ||
      !Number.isFinite(metadata.lockedAmount) ||
      !Number.isInteger(metadata.lockedAmount) ||
      metadata.lockedAmount < 0
    ) {
      throw new Error(`Solar resolver ${solarPowerId} returned invalid ledger lockedAmount`);
    }
    lockedAmount = metadata.lockedAmount;
  }

  let targets: AncientSolarTargetReference[] | undefined;
  if (typeof metadata.targets !== 'undefined') {
    if (!Array.isArray(metadata.targets) || metadata.targets.length === 0) {
      throw new Error(`Solar resolver ${solarPowerId} returned invalid ledger targets`);
    }
    targets = metadata.targets.map((target, index) => {
      if (!target || typeof target !== 'object' || Array.isArray(target)) {
        throw new Error(`Solar resolver ${solarPowerId} returned invalid ledger target ${index}`);
      }
      const targetRecord = target as Record<string, unknown>;
      const unsupportedTargetField = Object.keys(targetRecord).find(
        (field) => field !== 'playerId' && field !== 'shipInstanceId',
      );
      if (unsupportedTargetField) {
        throw new Error(`Solar resolver ${solarPowerId} returned unsupported ledger target field: ${unsupportedTargetField}`);
      }
      const playerId = requireResolverMetadataId(targetRecord.playerId, `targets[${index}].playerId`);
      const shipInstanceId = typeof targetRecord.shipInstanceId === 'undefined'
        ? undefined
        : requireResolverMetadataId(targetRecord.shipInstanceId, `targets[${index}].shipInstanceId`);
      return { playerId, ...(shipInstanceId ? { shipInstanceId } : {}) };
    });
  }

  let simulacrum: AncientSimulacrumPresentation | undefined;
  if (typeof metadata.simulacrum !== 'undefined') {
    if (!metadata.simulacrum || typeof metadata.simulacrum !== 'object' || Array.isArray(metadata.simulacrum)) {
      throw new Error(`Solar resolver ${solarPowerId} returned invalid ledger simulacrum metadata`);
    }
    const source = metadata.simulacrum as Record<string, unknown>;
    const unsupportedSimulacrumField = Object.keys(source).find(
      (field) =>
        ![
          'sourceTargetInstanceId',
          'copiedShipDefId',
          'capturedStartOfBattleCharges',
          'permanentConfiguration',
          'matchupKey',
        ].includes(field),
    );
    if (unsupportedSimulacrumField) {
      throw new Error(`Solar resolver ${solarPowerId} returned unsupported Simulacrum metadata: ${unsupportedSimulacrumField}`);
    }
    const sourceTargetInstanceId = requireResolverMetadataId(
      source.sourceTargetInstanceId,
      'simulacrum.sourceTargetInstanceId',
    );
    const copiedShipDefId = requireResolverMetadataId(
      source.copiedShipDefId,
      'simulacrum.copiedShipDefId',
    );
    const matchupKey = typeof source.matchupKey === 'undefined'
      ? undefined
      : requireResolverMetadataId(source.matchupKey, 'simulacrum.matchupKey');
    let capturedStartOfBattleCharges: number | undefined;
    if (typeof source.capturedStartOfBattleCharges !== 'undefined') {
      if (
        typeof source.capturedStartOfBattleCharges !== 'number' ||
        !Number.isFinite(source.capturedStartOfBattleCharges) ||
        !Number.isInteger(source.capturedStartOfBattleCharges) ||
        source.capturedStartOfBattleCharges < 0
      ) {
        throw new Error(
          `Solar resolver ${solarPowerId} returned invalid Simulacrum capturedStartOfBattleCharges`,
        );
      }
      capturedStartOfBattleCharges = source.capturedStartOfBattleCharges;
    }
    let permanentConfiguration: ShipPermanentConfiguration | undefined;
    if (typeof source.permanentConfiguration !== 'undefined') {
      if (!isPlainObject(source.permanentConfiguration)) {
        throw new Error(
          `Solar resolver ${solarPowerId} returned invalid Simulacrum permanentConfiguration`,
        );
      }
      const configuration = source.permanentConfiguration;
      const unsupportedConfigurationField = Object.keys(configuration).find(
        (field) => field !== 'selectedNumber',
      );
      if (unsupportedConfigurationField) {
        throw new Error(
          `Solar resolver ${solarPowerId} returned unsupported Simulacrum permanentConfiguration field: ${unsupportedConfigurationField}`,
        );
      }
      const selectedNumber = configuration.selectedNumber;
      if (
        typeof selectedNumber !== 'undefined' &&
        (
          typeof selectedNumber !== 'number' ||
          !Number.isInteger(selectedNumber) ||
          selectedNumber < 1 ||
          selectedNumber > 6
        )
      ) {
        throw new Error(
          `Solar resolver ${solarPowerId} returned invalid Simulacrum selectedNumber`,
        );
      }
      permanentConfiguration = typeof selectedNumber === 'number'
        ? { selectedNumber }
        : {};
    }
    simulacrum = {
      sourceTargetInstanceId,
      copiedShipDefId,
      ...(typeof capturedStartOfBattleCharges === 'number'
        ? { capturedStartOfBattleCharges }
        : {}),
      ...(permanentConfiguration ? { permanentConfiguration } : {}),
      ...(matchupKey ? { matchupKey } : {}),
    };
  }

  return {
    ...(typeof lockedAmount === 'number' ? { lockedAmount } : {}),
    ...(targets ? { targets } : {}),
    ...(simulacrum ? { simulacrum } : {}),
  };
}

export function resolveSolarCastSequence(args: {
  state: any;
  playerId: string;
  declarationId: string;
  battleTurnNumber: number;
  initialEnergy: AncientEnergyPool;
  casts: AncientNormalizedSolarCast[];
  resolvers: Readonly<ManualSolarResolverRegistry>;
  sourceMode: AncientSolarSourceMode;
  initialLedgerOrder: number;
  initialCastIndex?: number;
}): ManualSolarDeclarationResult {
  let workingState = args.state;
  let remainingEnergy = cloneEnergyPool(args.initialEnergy);
  const acceptedCasts: AncientNormalizedSolarCast[] = [];
  const ledgerEntries: AncientSolarLedgerEntry[] = [];
  const effects: Effect[] = [];
  const effectEvents: EffectEvent[] = [];

  for (const [localIndex, cast] of args.casts.entries()) {
    const castIndex = (args.initialCastIndex ?? 0) + localIndex;
    const ledgerOrder = args.initialLedgerOrder + localIndex;
    const descriptor = args.resolvers[cast.solarPowerId];
    if (!descriptor) {
      throw new Error(`Solar Power is not implemented: ${cast.solarPowerId}`);
    }
    validateAcceptedFields(cast, descriptor);

    const castIdentity =
      `ancient-solar:${args.battleTurnNumber}:${args.playerId}:${args.declarationId}:${args.sourceMode}:${castIndex}`;
    const resolverState = structuredClone(workingState);
    const stateBeforeResolver = JSON.stringify(resolverState);
    const resolverResult = descriptor.resolve({
      state: resolverState,
      playerId: args.playerId,
      declarationId: args.declarationId,
      battleTurnNumber: args.battleTurnNumber,
      castIndex,
      ledgerOrder,
      sourceMode: args.sourceMode,
      castIdentity,
      cast,
      remainingEnergy: cloneEnergyPool(remainingEnergy),
    });
    if (JSON.stringify(resolverState) !== stateBeforeResolver) {
      throw new Error(`Solar resolver ${cast.solarPowerId} mutated its supplied state`);
    }
    if (
      !resolverResult ||
      typeof resolverResult !== 'object' ||
      !resolverResult.candidateState ||
      typeof resolverResult.candidateState !== 'object' ||
      Array.isArray(resolverResult.candidateState)
    ) {
      throw new Error(`Solar resolver ${cast.solarPowerId} returned invalid candidate state`);
    }
    if (!Array.isArray(resolverResult.effects)) {
      throw new Error(`Solar resolver ${cast.solarPowerId} returned invalid effects`);
    }

    const canonicalPaidEnergy = validatePaidEnergy(resolverResult.paidEnergy, cast.solarPowerId);
    for (const colour of ENERGY_COLOURS) {
      if (canonicalPaidEnergy[colour] > remainingEnergy[colour]) {
        throw new Error(`Insufficient ${colour} Energy for ${cast.solarPowerId} at cast ${castIndex}`);
      }
    }
    const paidEnergy = canonicalPaidEnergy;
    const ledgerMetadata = validateLedgerMetadata(
      resolverResult.ledgerMetadata,
      cast.solarPowerId,
    );

    remainingEnergy = {
      green: remainingEnergy.green - paidEnergy.green,
      red: remainingEnergy.red - paidEnergy.red,
      blue: remainingEnergy.blue - paidEnergy.blue,
    };
    workingState = resolverResult.candidateState;
    if (resolverResult.effects.length > 0) {
      const applied = applyEffects(workingState, resolverResult.effects);
      workingState = applied.state;
      effectEvents.push(...applied.events);
      effects.push(...resolverResult.effects);
    }

    acceptedCasts.push(structuredClone(cast));
    ledgerEntries.push({
      entryId: castIdentity,
      order: ledgerOrder,
      solarPowerId: cast.solarPowerId,
      sourceMode: args.sourceMode,
      paidEnergy: cloneEnergyPool(paidEnergy),
      ...(typeof ledgerMetadata?.lockedAmount === 'number'
        ? { lockedAmount: ledgerMetadata.lockedAmount }
        : {}),
      ...(ledgerMetadata?.targets
        ? { targets: structuredClone(ledgerMetadata.targets) }
        : {}),
      ...(ledgerMetadata?.simulacrum
        ? { simulacrum: structuredClone(ledgerMetadata.simulacrum) }
        : {}),
    });
  }

  return {
    state: workingState,
    remainingEnergy,
    acceptedCasts,
    ledgerEntries,
    effects,
    effectEvents,
  };
}

export function resolveManualSolarDeclaration(args: {
  state: any;
  playerId: string;
  declarationId: string;
  battleTurnNumber: number;
  initialEnergy: AncientEnergyPool;
  casts: AncientNormalizedSolarCast[];
  resolvers: Readonly<ManualSolarResolverRegistry>;
}): ManualSolarDeclarationResult {
  return resolveSolarCastSequence({
    ...args,
    sourceMode: 'manual',
    initialLedgerOrder: 0,
  });
}
