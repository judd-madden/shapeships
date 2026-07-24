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
  return {
    activeSourceInstanceId: args.activeTargeting.activeSourceInstanceId,
    targetStatesBySide: {
      my: {
        ...args.persistentMarkers.targetStatesBySide.my,
        ...args.activeTargeting.targetStatesBySide.my,
      },
      opponent: {
        ...args.persistentMarkers.targetStatesBySide.opponent,
        ...args.activeTargeting.targetStatesBySide.opponent,
      },
    },
    previewShipDefIdBySide: {
      my: { ...args.activeTargeting.previewShipDefIdBySide.my },
      opponent: { ...args.activeTargeting.previewShipDefIdBySide.opponent },
    },
  };
}
