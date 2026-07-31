import type {
  CubeDiceChoiceId,
  CubeDiceChoicePanelVm,
  CubeDiceValue,
} from './types';

export interface CubeDiceChoiceActionInput {
  kind?: unknown;
  actionId?: unknown;
  shipDefId?: unknown;
  sourceInstanceId?: unknown;
  choices?: unknown;
}

interface CubeDiceChoiceInput {
  choiceId?: unknown;
  projectedAmount?: unknown;
}

interface ValidCubeDiceChoice {
  choiceId: CubeDiceChoiceId;
  projectedAmount: CubeDiceValue;
}

interface ValidCubeDiceChoiceAction {
  kind: 'choice';
  actionId: 'CUB#0';
  shipDefId: 'CUB';
  sourceInstanceId: string;
  choices: ValidCubeDiceChoice[];
}

function isCubeDiceValue(value: unknown): value is CubeDiceValue {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 6;
}

function parseCubeChoiceId(
  choiceId: unknown
): { choiceId: CubeDiceChoiceId; sourceInstanceId?: string } | null {
  if (choiceId === 'main') {
    return { choiceId: 'main' };
  }

  if (typeof choiceId !== 'string' || !choiceId.startsWith('cube:')) {
    return null;
  }

  const sourceInstanceId = choiceId.slice('cube:'.length);
  if (sourceInstanceId.length === 0) {
    return null;
  }

  return {
    choiceId: `cube:${sourceInstanceId}`,
    sourceInstanceId,
  };
}

function getValidCubeDiceChoiceAction(
  action: CubeDiceChoiceActionInput | null | undefined
): ValidCubeDiceChoiceAction | null {
  if (
    action?.kind !== 'choice' ||
    action.actionId !== 'CUB#0' ||
    action.shipDefId !== 'CUB' ||
    typeof action.sourceInstanceId !== 'string' ||
    action.sourceInstanceId.length === 0 ||
    !Array.isArray(action.choices)
  ) {
    return null;
  }

  const choices: ValidCubeDiceChoice[] = [];
  const cubeChoiceIds = new Set<string>();
  let mainChoiceCount = 0;

  for (const rawChoice of action.choices as CubeDiceChoiceInput[]) {
    const parsedChoice = parseCubeChoiceId(rawChoice?.choiceId);
    if (!parsedChoice || !isCubeDiceValue(rawChoice?.projectedAmount)) {
      return null;
    }

    if (parsedChoice.choiceId === 'main') {
      mainChoiceCount += 1;
    } else {
      if (cubeChoiceIds.has(parsedChoice.choiceId)) {
        return null;
      }
      cubeChoiceIds.add(parsedChoice.choiceId);
    }

    choices.push({
      choiceId: parsedChoice.choiceId,
      projectedAmount: rawChoice.projectedAmount,
    });
  }

  if (
    mainChoiceCount !== 1 ||
    cubeChoiceIds.size === 0 ||
    choices[0]?.choiceId !== 'main'
  ) {
    return null;
  }

  return {
    kind: 'choice',
    actionId: 'CUB#0',
    shipDefId: 'CUB',
    sourceInstanceId: action.sourceInstanceId,
    choices,
  };
}

export function isRenderableCubeDiceChoiceAction(
  action: CubeDiceChoiceActionInput | null | undefined
): boolean {
  return getValidCubeDiceChoiceAction(action) != null;
}

export function getDefaultCubeDiceChoiceId(
  action: CubeDiceChoiceActionInput | null | undefined
): CubeDiceChoiceId | undefined {
  const validAction = getValidCubeDiceChoiceAction(action);
  if (!validAction) {
    return undefined;
  }

  let bestChoice = validAction.choices[0];
  for (const candidate of validAction.choices.slice(1)) {
    const isHigherValue =
      candidate.projectedAmount > bestChoice.projectedAmount;
    const isCubeTiedWithMain =
      candidate.projectedAmount === bestChoice.projectedAmount &&
      candidate.choiceId !== 'main' &&
      bestChoice.choiceId === 'main';

    if (isHigherValue || isCubeTiedWithMain) {
      bestChoice = candidate;
    }
  }

  return bestChoice.choiceId;
}

export function deriveCubeDiceChoicePanelVm(args: {
  action: CubeDiceChoiceActionInput | null | undefined;
  selectedChoiceId?: string;
}): CubeDiceChoicePanelVm | undefined {
  const validAction = getValidCubeDiceChoiceAction(args.action);
  if (!validAction) {
    return undefined;
  }

  const defaultChoiceId = getDefaultCubeDiceChoiceId(validAction);
  if (!defaultChoiceId) {
    return undefined;
  }

  const availableChoiceIds = new Set(
    validAction.choices.map((choice) => choice.choiceId)
  );
  const selectedChoiceId =
    typeof args.selectedChoiceId === 'string' &&
    availableChoiceIds.has(args.selectedChoiceId as CubeDiceChoiceId)
      ? (args.selectedChoiceId as CubeDiceChoiceId)
      : defaultChoiceId;
  const mainChoice = validAction.choices.find(
    (choice) => choice.choiceId === 'main'
  );

  if (!mainChoice) {
    return undefined;
  }

  return {
    sourceInstanceId: validAction.sourceInstanceId,
    selectedChoiceId,
    mainChoice: {
      choiceId: 'main',
      kind: 'main',
      value: mainChoice.projectedAmount,
    },
    cubeChoices: validAction.choices
      .filter(
        (choice): choice is ValidCubeDiceChoice & { choiceId: `cube:${string}` } =>
          choice.choiceId.startsWith('cube:')
      )
      .map((choice) => ({
        choiceId: choice.choiceId,
        kind: 'cube' as const,
        value: choice.projectedAmount,
        sourceInstanceId: choice.choiceId.slice('cube:'.length),
      })),
  };
}
