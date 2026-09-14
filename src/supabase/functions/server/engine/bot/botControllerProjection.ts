import type { BotSpeciesId, SeatController } from './botTypes.ts';

export type PublicSeatController =
  | { kind: 'player' }
  | {
      kind: 'bot';
      speciesId: BotSpeciesId | null;
      chosenPlanId: string | null;
    };

export type PublicSeatControllerProjectionOptions = {
  speciesSelectionResolved: boolean;
};

export function projectPublicSeatControllers(
  controllersByPlayerId: unknown,
  options: PublicSeatControllerProjectionOptions,
): Record<string, PublicSeatController> {
  if (
    !controllersByPlayerId ||
    typeof controllersByPlayerId !== 'object' ||
    Array.isArray(controllersByPlayerId)
  ) {
    return {};
  }

  const projected: Record<string, PublicSeatController> = {};
  for (const [playerId, rawController] of Object.entries(
    controllersByPlayerId,
  )) {
    const controller = rawController as SeatController;
    if (controller?.kind === 'human') {
      projected[playerId] = { kind: 'player' };
      continue;
    }
    if (controller?.kind === 'bot') {
      projected[playerId] = {
        kind: 'bot',
        speciesId: options.speciesSelectionResolved
          ? controller.speciesId ?? null
          : null,
        chosenPlanId:
          options.speciesSelectionResolved &&
            typeof controller.chosenPlanId === 'string'
            ? controller.chosenPlanId
            : null,
      };
    }
  }

  return projected;
}
