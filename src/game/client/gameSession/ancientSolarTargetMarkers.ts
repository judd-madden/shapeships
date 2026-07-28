import type {
  AncientSolarDisplayEntry,
  BoardDestroyTargetingViewModel,
  BoardFleetSummary,
  BoardTargetSelectedTone,
} from './types';

function makeEmptyTargetingViewModel(): BoardDestroyTargetingViewModel {
  return {
    activeSourceInstanceId: null,
    targetStatesBySide: {
      my: {},
      opponent: {},
    },
    previewShipDefIdBySide: {
      my: {},
      opponent: {},
    },
  };
}

export function buildPersistentAncientSolarTargetMarkers(args: {
  active: boolean;
  solarEntries: readonly AncientSolarDisplayEntry[];
  myFleet: readonly BoardFleetSummary[];
  opponentFleet: readonly BoardFleetSummary[];
}): BoardDestroyTargetingViewModel {
  const targeting = makeEmptyTargetingViewModel();
  if (!args.active) {
    return targeting;
  }

  const toneByInstanceId = new Map<string, BoardTargetSelectedTone>();
  for (const entry of args.solarEntries) {
    const marker = entry.targetMarker;
    if (!marker) continue;

    for (const instanceId of marker.targetInstanceIds) {
      const existingTone = toneByInstanceId.get(instanceId);
      if (marker.tone === 'red' || existingTone == null) {
        toneByInstanceId.set(instanceId, marker.tone);
      }
    }
  }

  const addFleetMarkers = (
    side: keyof BoardDestroyTargetingViewModel['targetStatesBySide'],
    fleet: readonly BoardFleetSummary[]
  ) => {
    for (const stack of fleet) {
      let selectedTone: BoardTargetSelectedTone | null = null;
      for (const instanceId of stack.memberInstanceIds) {
        const instanceTone = toneByInstanceId.get(instanceId);
        if (instanceTone === 'red') {
          selectedTone = 'red';
          break;
        }
        if (instanceTone === 'cyan') {
          selectedTone = 'cyan';
        }
      }

      if (selectedTone) {
        targeting.targetStatesBySide[side][stack.stackKey] = {
          isTargetable: false,
          isHovered: false,
          isSelected: true,
          selectedTone,
        };
      }
    }
  };

  addFleetMarkers('my', args.myFleet);
  addFleetMarkers('opponent', args.opponentFleet);
  return targeting;
}

export function overlayAncientSolarTargetMarkers(args: {
  activeTargeting: BoardDestroyTargetingViewModel;
  persistentMarkers: BoardDestroyTargetingViewModel;
}): BoardDestroyTargetingViewModel {
  const mergeSide = (
    side: keyof BoardDestroyTargetingViewModel['targetStatesBySide']
  ): BoardDestroyTargetingViewModel['targetStatesBySide'][typeof side] => {
    const activeStates = args.activeTargeting.targetStatesBySide[side];
    const persistentStates = args.persistentMarkers.targetStatesBySide[side];
    const stackKeys = new Set([
      ...Object.keys(persistentStates),
      ...Object.keys(activeStates),
    ]);
    const mergedStates: BoardDestroyTargetingViewModel['targetStatesBySide'][typeof side] = {};

    for (const stackKey of stackKeys) {
      const active = activeStates[stackKey];
      const persistent = persistentStates[stackKey];
      const selectedTone = persistent?.selectedTone ?? active?.selectedTone;
      mergedStates[stackKey] = {
        isSelected:
          persistent?.isSelected === true || active?.isSelected === true,
        isTargetable:
          active?.isTargetable ?? persistent?.isTargetable ?? false,
        isHovered: active?.isHovered ?? persistent?.isHovered ?? false,
        ...(selectedTone ? { selectedTone } : {}),
      };
    }

    return mergedStates;
  };

  return {
    activeSourceInstanceId: args.activeTargeting.activeSourceInstanceId,
    targetStatesBySide: {
      my: mergeSide('my'),
      opponent: mergeSide('opponent'),
    },
    previewShipDefIdBySide: {
      my: { ...args.activeTargeting.previewShipDefIdBySide.my },
      opponent: { ...args.activeTargeting.previewShipDefIdBySide.opponent },
    },
  };
}
