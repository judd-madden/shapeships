export type DestroyTargetDraftAction = {
  kind: string;
  actionId?: string;
  shipDefId?: string;
  sourceInstanceId?: string;
  choices?: Array<{ choiceId?: string; projectedAmount?: number }>;
  requiredTargetCount?: number;
  validTargets?: any[];
  validOwnTargets?: any[];
  validOpponentTargets?: any[];
};

export type DestroyTargetDraftState = {
  locatorKeysBySourceInstanceId: Record<string, string[]>;
  exactTargetIdsBySourceInstanceId: Record<string, string[]>;
};

export type DestroyTargetFocusState = {
  sourceInstanceId: string;
  origin: 'automatic' | 'explicit';
} | null;

type DestroyTargetSide = 'my' | 'opponent';

function splitLocatorKey(
  locatorKey: string
): { side: DestroyTargetSide; stackKey: string } | null {
  const [side, stackKey] = locatorKey.split('::');
  if ((side !== 'my' && side !== 'opponent') || !stackKey) return null;
  return { side, stackKey };
}

function getRequiredTargetCount(action: DestroyTargetDraftAction): number {
  const count = Number(action.requiredTargetCount);
  return Number.isInteger(count) && count > 0 ? count : 1;
}

function getValidTargetIds(action: DestroyTargetDraftAction): Set<string> {
  if (action.kind === 'paired_destroy_target') {
    return new Set(
      [
        ...(Array.isArray(action.validOwnTargets) ? action.validOwnTargets : []),
        ...(Array.isArray(action.validOpponentTargets)
          ? action.validOpponentTargets
          : []),
      ]
        .map((target: any) => target?.instanceId)
        .filter(
          (instanceId: unknown): instanceId is string =>
            typeof instanceId === 'string'
        )
    );
  }

  return new Set(
    Array.isArray(action.validTargets)
      ? action.validTargets
          .map((target: any) => target?.instanceId)
          .filter(
            (instanceId: unknown): instanceId is string =>
              typeof instanceId === 'string'
          )
      : []
  );
}

function getPairedDescriptorsByLocatorKey(args: {
  action: DestroyTargetDraftAction;
  visibleTargetIdsByLocatorKey: Record<string, string[]>;
}) {
  const ownById = new Map(
    (Array.isArray(args.action.validOwnTargets)
      ? args.action.validOwnTargets
      : []
    ).map((target: any) => [target.instanceId, target] as const)
  );
  const opponentById = new Map(
    (Array.isArray(args.action.validOpponentTargets)
      ? args.action.validOpponentTargets
      : []
    ).map((target: any) => [target.instanceId, target] as const)
  );
  const ownDescriptorsByLocatorKey = new Map<string, any[]>();
  const opponentDescriptorsByLocatorKey = new Map<string, any[]>();

  for (const [locatorKey, visibleTargetIds] of Object.entries(
    args.visibleTargetIdsByLocatorKey
  )) {
    const ownMatches = visibleTargetIds
      .map((instanceId) => ownById.get(instanceId) ?? null)
      .filter((target): target is NonNullable<typeof target> => target != null);
    const opponentMatches = visibleTargetIds
      .map((instanceId) => opponentById.get(instanceId) ?? null)
      .filter((target): target is NonNullable<typeof target> => target != null);
    if (ownMatches.length > 0) {
      ownDescriptorsByLocatorKey.set(locatorKey, ownMatches);
    }
    if (opponentMatches.length > 0) {
      opponentDescriptorsByLocatorKey.set(locatorKey, opponentMatches);
    }
  }

  return { ownDescriptorsByLocatorKey, opponentDescriptorsByLocatorKey };
}

export function allocatePinnedTargetIdsForLocators(args: {
  action: DestroyTargetDraftAction;
  locatorKeys: string[];
  visibleTargetIdsByLocatorKey: Record<string, string[]>;
  reservedTargetIds?: ReadonlySet<string>;
  preferredTargetIds?: readonly string[];
}): string[] {
  const {
    action,
    locatorKeys,
    visibleTargetIdsByLocatorKey,
    reservedTargetIds = new Set<string>(),
    preferredTargetIds = [],
  } = args;

  if (action.kind === 'paired_destroy_target') {
    const { ownDescriptorsByLocatorKey, opponentDescriptorsByLocatorKey } =
      getPairedDescriptorsByLocatorKey({ action, visibleTargetIdsByLocatorKey });
    if (locatorKeys.length === 0) return [];

    const firstLocatorKey = locatorKeys[0];
    const firstLocator = splitLocatorKey(firstLocatorKey);
    if (!firstLocator) return [];
    const firstCandidates =
      firstLocator.side === 'my'
        ? ownDescriptorsByLocatorKey.get(firstLocatorKey) ?? []
        : opponentDescriptorsByLocatorKey.get(firstLocatorKey) ?? [];
    const preferredFirstTargetId = preferredTargetIds[0];
    const firstTarget =
      firstCandidates.find(
        (target) =>
          target.instanceId === preferredFirstTargetId &&
          !reservedTargetIds.has(target.instanceId)
      ) ??
      firstCandidates.find(
        (target) => !reservedTargetIds.has(target.instanceId)
      );
    if (!firstTarget) return [];
    if (locatorKeys.length === 1) return [firstTarget.instanceId];

    const secondLocatorKey = locatorKeys[1];
    const secondLocator = splitLocatorKey(secondLocatorKey);
    if (!secondLocator || secondLocator.side === firstLocator.side) {
      return [firstTarget.instanceId];
    }
    const secondCandidates =
      secondLocator.side === 'my'
        ? ownDescriptorsByLocatorKey.get(secondLocatorKey) ?? []
        : opponentDescriptorsByLocatorKey.get(secondLocatorKey) ?? [];
    const isValidSecondTarget = (target: any) =>
      target.totalLineCost === firstTarget.totalLineCost &&
      target.instanceId !== firstTarget.instanceId &&
      !reservedTargetIds.has(target.instanceId);
    const preferredSecondTargetId = preferredTargetIds[1];
    const secondTarget =
      secondCandidates.find(
        (target) =>
          target.instanceId === preferredSecondTargetId &&
          isValidSecondTarget(target)
      ) ?? secondCandidates.find(isValidSecondTarget);
    return secondTarget
      ? [firstTarget.instanceId, secondTarget.instanceId]
      : [firstTarget.instanceId];
  }

  const validTargetIds = getValidTargetIds(action);
  const usedTargetIds = new Set<string>();
  const allocatedTargetIds: string[] = [];
  for (let index = 0; index < locatorKeys.length; index += 1) {
    const visibleTargetIds =
      visibleTargetIdsByLocatorKey[locatorKeys[index]] ?? [];
    const preferredTargetId = preferredTargetIds[index];
    const isAvailable = (targetId: string) =>
      validTargetIds.has(targetId) &&
      !reservedTargetIds.has(targetId) &&
      !usedTargetIds.has(targetId);
    const targetId =
      preferredTargetId != null &&
      visibleTargetIds.includes(preferredTargetId) &&
      isAvailable(preferredTargetId)
        ? preferredTargetId
        : visibleTargetIds.find(isAvailable);
    if (!targetId) break;
    usedTargetIds.add(targetId);
    allocatedTargetIds.push(targetId);
  }
  return allocatedTargetIds;
}

export function clearDestroyTargetDraftSource(
  draft: DestroyTargetDraftState,
  sourceInstanceId: string
): DestroyTargetDraftState {
  if (
    !(sourceInstanceId in draft.locatorKeysBySourceInstanceId) &&
    !(sourceInstanceId in draft.exactTargetIdsBySourceInstanceId)
  ) {
    return draft;
  }
  const locatorKeysBySourceInstanceId = {
    ...draft.locatorKeysBySourceInstanceId,
  };
  const exactTargetIdsBySourceInstanceId = {
    ...draft.exactTargetIdsBySourceInstanceId,
  };
  delete locatorKeysBySourceInstanceId[sourceInstanceId];
  delete exactTargetIdsBySourceInstanceId[sourceInstanceId];
  return { locatorKeysBySourceInstanceId, exactTargetIdsBySourceInstanceId };
}

export function deriveDestroyTargetSelectionEdit(args: {
  action: DestroyTargetDraftAction;
  currentLocatorKeys: string[];
  currentExactTargetIds: string[];
  clickedLocatorKey: string;
  visibleTargetIdsByLocatorKey: Record<string, string[]>;
  reservedTargetIds: ReadonlySet<string>;
}): { locatorKeys: string[]; exactTargetIds: string[] } | null {
  const requiredTargetCount = getRequiredTargetCount(args.action);
  const pairReseed =
    args.action.kind === 'paired_destroy_target' &&
    args.currentLocatorKeys.length >= requiredTargetCount;
  const singleReplacement =
    args.action.kind !== 'paired_destroy_target' &&
    requiredTargetCount === 1 &&
    args.currentLocatorKeys.length >= requiredTargetCount;
  if (
    args.currentLocatorKeys.length >= requiredTargetCount &&
    !pairReseed &&
    !singleReplacement
  ) {
    return null;
  }

  const locatorKeys =
    pairReseed || singleReplacement
      ? [args.clickedLocatorKey]
      : [...args.currentLocatorKeys, args.clickedLocatorKey];
  const reservedTargetIds = singleReplacement
    ? new Set([...args.reservedTargetIds, ...args.currentExactTargetIds])
    : args.reservedTargetIds;
  const exactTargetIds = allocatePinnedTargetIdsForLocators({
    action: args.action,
    locatorKeys,
    visibleTargetIdsByLocatorKey: args.visibleTargetIdsByLocatorKey,
    reservedTargetIds,
    preferredTargetIds:
      pairReseed || singleReplacement ? [] : args.currentExactTargetIds,
  });
  return exactTargetIds.length === locatorKeys.length
    ? { locatorKeys, exactTargetIds }
    : null;
}

export function resolveDestroyTargetFocus(args: {
  current: DestroyTargetFocusState;
  currentAvailable: boolean;
  currentSatisfied: boolean;
  currentHasAllocatableTarget: boolean;
  autoArmSourceInstanceId: string | null;
}): DestroyTargetFocusState {
  if (args.current?.origin === 'explicit' && args.currentAvailable) {
    return args.current;
  }
  if (
    args.current?.origin === 'automatic' &&
    args.currentAvailable &&
    !args.currentSatisfied &&
    args.currentHasAllocatableTarget
  ) {
    return args.current;
  }
  if (args.autoArmSourceInstanceId != null) {
    return {
      sourceInstanceId: args.autoArmSourceInstanceId,
      origin: 'automatic',
    };
  }
  return args.currentAvailable ? args.current : null;
}
