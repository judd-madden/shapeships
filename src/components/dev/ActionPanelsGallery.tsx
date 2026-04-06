/**
 * ActionPanelsGallery - Dev-only preview for all Action Panels
 *
 * Static reference surface for current ActionPanel contracts.
 * Uses real panels via ActionPanelFrame with hand-authored fixtures only.
 */

import { ActionPanelFrame } from '../../game/display/actionPanel/ActionPanelFrame';
import {
  ACTION_PANEL_DISPLAY_NAMES,
  ACTION_PANEL_IDS,
  type ActionPanelId,
} from '../../game/display/actionPanel/ActionPanelRegistry';
import type {
  ActionPanelTabVm,
  ActionPanelViewModel,
  GameSessionActions,
} from '../../game/client/gameSession/types';
import {
  getShipChoicePanelSpec,
  type ShipChoiceButtonsPanelSpec,
  type ShipChoiceCountedShipGroupSpec,
  type ShipChoiceNamedShipGroupSpec,
} from '../../game/display/actionPanel/panels/ShipChoiceRegistry';
import type { ShipChoiceGroupSpec, ShipChoicesPanelGroup } from '../../game/types/ShipChoiceTypes';
import type { ShipDefId } from '../../game/types/ShipTypes.engine';

type BuildEligibility = NonNullable<
  ActionPanelViewModel['buildCatalogue']['eligibilityByShipId'][ShipDefId]
>;
type ShipChoiceVm = NonNullable<ActionPanelViewModel['shipChoices']>;
type CentaurChargeTabs = NonNullable<ShipChoiceVm['centaurChargeTabs']>;
type SelectedChoiceMap = Record<string, string>;
type ChoiceShipInstance = ShipChoiceGroupSpec;

const NOOP = () => {};

const DUMMY_TABS: ActionPanelTabVm[] = [
  {
    tabId: 'tab.catalog.self',
    label: 'Human',
    visible: true,
    targetPanelId: 'ap.catalog.ships.human',
  },
  {
    tabId: 'tab.catalog.opponent',
    label: 'Centaur',
    visible: true,
    targetPanelId: 'ap.catalog.ships.centaur',
  },
  {
    tabId: 'tab.actions',
    label: 'Actions',
    visible: true,
    targetPanelId: 'ap.battle.charges.centaur',
  },
  {
    tabId: 'tab.menu',
    label: 'Menu',
    visible: true,
    targetPanelId: 'ap.menu.root',
  },
];

const DUMMY_ACTIONS: GameSessionActions = {
  onReadyToggle: NOOP,
  onUndoActions: NOOP,
  onOpenMenu: NOOP,
  onActionPanelTabClick: () => {},
  onShipClick: () => {},
  onSendChat: () => {},
  onAcceptDraw: NOOP,
  onRefuseDraw: NOOP,
  onOpenBattleLogFullscreen: NOOP,
  onSelectSpecies: () => {},
  onConfirmSpecies: NOOP,
  onCopyGameUrl: NOOP,
  onBuildShip: () => {},
  onOfferDraw: NOOP,
  onResignGame: NOOP,
  onRematch: NOOP,
  onDownloadBattleLog: NOOP,
  onSelectShipChoiceForInstance: () => {},
  onSelectCentaurChargeSubTab: () => {},
  onSelectFrigateTrigger: () => {},
  onSelectEvolverChoice: () => {},
  onBoardBackgroundMouseDown: NOOP,
  onDestroyTargetStackHoverChange: () => {},
  onDestroyTargetStackMouseDown: () => {},
};

const BUILDABLE_CATALOGUE_FIXTURE: ActionPanelViewModel['buildCatalogue'] = {
  context: 'buildable',
  canAddShipById: {
    DEF: true,
    ANG: true,
    XEN: true,
    MER: true,
  },
  displayCostByShipId: {
    CAR: 5,
    KNO: 11,
    SAC: 10,
  },
  eligibilityByShipId: {
    DEF: buildEligibility('CAN_BUILD'),
    CAR: buildEligibility('NEED_COMPONENTS', ['DEF', 'FIG']),
    LEV: buildEligibility('NOT_ENOUGH_LINES'),
    KNO: buildEligibility('CAN_BUILD'),
    SAC: buildEligibility('NEED_COMPONENTS', ['XEN', 'BUG']),
    HVE: buildEligibility('MAX_LIMIT'),
  },
};

const REFERENCE_ONLY_CATALOGUE_FIXTURE: ActionPanelViewModel['buildCatalogue'] = {
  context: 'reference_only',
  canAddShipById: {},
  displayCostByShipId: {},
  eligibilityByShipId: {},
};

const MENU_FIXTURE: ActionPanelViewModel['menu'] = {
  title: 'Shapeships Game: Judy vs Rowan',
  subtitle: 'Dev gallery snapshot',
  turnNumber: 8,
  phaseKey: 'battle.charge_declaration',
  hasActionsForMe: true,
  canOfferDraw: true,
  canResign: true,
};

const END_OF_GAME_FIXTURE: NonNullable<ActionPanelViewModel['endOfGame']> = {
  bannerText: 'Victory! Human fleet holds the field.',
  bannerBgCssVar: 'var(--shapeships-pastel-blue)',
  metaLeftText: 'Judy - Human - 22 health',
  metaRightText: 'Rowan - Centaur - 0 health',
};

const FRIGATE_DRAWING_FIXTURE: NonNullable<ActionPanelViewModel['frigateDrawing']> = {
  frigateCount: 3,
  selectedTriggers: [2, 4, 6],
};

const EVOLVER_DRAWING_FIXTURE: NonNullable<ActionPanelViewModel['evolverDrawing']> = {
  rows: [
    { rowId: 'evolver-row-1', choiceId: 'hold' },
    { rowId: 'evolver-row-2', choiceId: 'oxite' },
    { rowId: 'evolver-row-3', choiceId: 'asterite' },
  ],
};

const CHARGE_CALLOUT = {
  heading: 'Your opponent also has charges available.',
  lines: [
    'If you use any charge actions, they may respond.',
    'If they respond, you may answer with your remaining charges.',
    'If both sides hold all charges, play proceeds immediately.',
  ],
};

function buildEligibility(
  state: BuildEligibility['state'],
  missingComponentTokens?: string[]
): BuildEligibility {
  return missingComponentTokens
    ? ({ state, missingComponentTokens } as BuildEligibility)
    : ({ state } as BuildEligibility);
}

function getButtonsSpecOrThrow(panelId: ActionPanelId): ShipChoiceButtonsPanelSpec {
  const spec = getShipChoicePanelSpec(panelId);
  if (!spec || spec.kind !== 'buttons') {
    throw new Error(`Expected buttons panel spec for ${panelId}`);
  }
  return spec;
}

function getCountedGroupSpec(
  panelId: ActionPanelId,
  groupIndex: number
): ShipChoiceCountedShipGroupSpec {
  const group = getButtonsSpecOrThrow(panelId).groups[groupIndex];
  if (!group || group.kind !== 'counted') {
    throw new Error(`Expected counted group ${groupIndex} for ${panelId}`);
  }
  return group;
}

function getNamedGroupSpec(
  panelId: ActionPanelId,
  groupIndex: number
): ShipChoiceNamedShipGroupSpec {
  const group = getButtonsSpecOrThrow(panelId).groups[groupIndex];
  if (!group || group.kind !== 'named') {
    throw new Error(`Expected named group ${groupIndex} for ${panelId}`);
  }
  return group;
}

function formatCountedHeading(group: ShipChoiceCountedShipGroupSpec, count: number): string {
  const template =
    count === 1 && group.singularHeadingTemplate
      ? group.singularHeadingTemplate
      : group.headingTemplate;

  return template.replace('{count}', String(count));
}

function makeShipChoiceInstance(args: {
  shipDefId: ShipDefId;
  buttons: ChoiceShipInstance['buttons'];
  sourceInstanceId: string;
  availableChoiceIds?: string[];
  currentCharges?: number | null;
  explicitCharges?: number;
  internalTab?: ChoiceShipInstance['internalTab'];
}): ChoiceShipInstance {
  return {
    shipDefId: args.shipDefId,
    buttons: args.buttons,
    sourceInstanceId: args.sourceInstanceId,
    availableChoiceIds: args.availableChoiceIds,
    currentCharges: args.currentCharges,
    explicitCharges:
      args.explicitCharges ?? (args.currentCharges != null ? args.currentCharges : undefined),
    internalTab: args.internalTab,
  };
}

function buildStructuralAvailableActions(groups: ShipChoicesPanelGroup[]): any[] {
  return groups.flatMap((group) =>
    group.ships.flatMap((ship) =>
      ship.sourceInstanceId
        ? [
            {
              sourceInstanceId: ship.sourceInstanceId,
              shipDefId: ship.shipDefId,
              availableChoiceIds: ship.availableChoiceIds ?? [],
            },
          ]
        : []
    )
  );
}

function buildShipChoiceFixture(args: {
  groups: ShipChoicesPanelGroup[];
  selectedChoices?: Array<[string, string]>;
  showOpponentAlsoHasCharges?: boolean;
  opponentEligibleAtDeclarationStart?: boolean;
  centaurChargeTabs?: CentaurChargeTabs;
}): Pick<ActionPanelViewModel, 'shipChoices' | 'availableActions' | 'selectedChoiceIdBySourceInstanceId'> {
  const selectedChoiceIdBySourceInstanceId = Object.fromEntries(
    args.selectedChoices ?? []
  ) as SelectedChoiceMap;

  return {
    shipChoices: {
      groups: args.groups,
      showOpponentAlsoHasCharges: args.showOpponentAlsoHasCharges,
      opponentEligibleAtDeclarationStart: args.opponentEligibleAtDeclarationStart,
      opponentAlsoHasChargesHeading: args.showOpponentAlsoHasCharges
        ? CHARGE_CALLOUT.heading
        : undefined,
      opponentAlsoHasChargesLines: args.showOpponentAlsoHasCharges
        ? CHARGE_CALLOUT.lines
        : undefined,
      selectedChoiceIdBySourceInstanceId,
      centaurChargeTabs: args.centaurChargeTabs,
    },
    availableActions: buildStructuralAvailableActions(args.groups),
    selectedChoiceIdBySourceInstanceId,
  };
}

function buildCentaurDiceRollFixture(): Pick<
  ActionPanelViewModel,
  'shipChoices' | 'availableActions' | 'selectedChoiceIdBySourceInstanceId'
> {
  const group = getNamedGroupSpec('ap.build.dice_roll.centaur', 0);
  const sourceInstanceId = 'kno-gallery-1';

  return buildShipChoiceFixture({
    groups: [
      {
        heading: group.heading,
        ships: [
          makeShipChoiceInstance({
            shipDefId: group.ships[0].shipDefId,
            buttons: group.ships[0].buttons,
            sourceInstanceId,
            availableChoiceIds: ['reroll', 'hold'],
          }),
        ],
      },
    ],
    selectedChoices: [[sourceInstanceId, 'reroll']],
  });
}

function buildHumanShipsThatBuildFixture(): Pick<
  ActionPanelViewModel,
  'shipChoices' | 'availableActions' | 'selectedChoiceIdBySourceInstanceId'
> {
  const group = getCountedGroupSpec('ap.build.ships_that_build.human', 0);
  const carrierA = makeShipChoiceInstance({
    shipDefId: group.shipDefId,
    buttons: group.buttons,
    sourceInstanceId: 'car-human-a',
    availableChoiceIds: ['defender', 'fighter', 'hold'],
    currentCharges: 6,
  });
  const carrierB = makeShipChoiceInstance({
    shipDefId: group.shipDefId,
    buttons: group.buttons,
    sourceInstanceId: 'car-human-b',
    availableChoiceIds: ['defender', 'hold'],
    currentCharges: 1,
  });

  return buildShipChoiceFixture({
    groups: [
      {
        heading: formatCountedHeading(group, 2),
        ships: [carrierA, carrierB],
      },
    ],
    selectedChoices: [
      ['car-human-a', 'fighter'],
      ['car-human-b', 'hold'],
    ],
  });
}

function buildCentaurShipsThatBuildFixture(): Pick<
  ActionPanelViewModel,
  'shipChoices' | 'availableActions' | 'selectedChoiceIdBySourceInstanceId'
> {
  const group = getCountedGroupSpec('ap.build.ships_that_build.centaur.mixed', 0);
  const carrierA = makeShipChoiceInstance({
    shipDefId: group.shipDefId,
    buttons: group.buttons,
    sourceInstanceId: 'car-centaur-a',
    availableChoiceIds: ['defender', 'fighter', 'hold'],
    currentCharges: 4,
  });
  const carrierB = makeShipChoiceInstance({
    shipDefId: group.shipDefId,
    buttons: group.buttons,
    sourceInstanceId: 'car-centaur-b',
    availableChoiceIds: ['defender', 'hold'],
    currentCharges: 1,
  });
  const carrierC = makeShipChoiceInstance({
    shipDefId: group.shipDefId,
    buttons: group.buttons,
    sourceInstanceId: 'car-centaur-c',
    availableChoiceIds: ['defender', 'fighter', 'hold'],
    currentCharges: 2,
  });

  return buildShipChoiceFixture({
    groups: [
      {
        heading: formatCountedHeading(group, 3),
        ships: [carrierA, carrierB, carrierC],
      },
    ],
    selectedChoices: [
      ['car-centaur-a', 'defender'],
      ['car-centaur-b', 'hold'],
      ['car-centaur-c', 'fighter'],
    ],
  });
}

function buildXeniteShipsThatBuildFixture(): Pick<
  ActionPanelViewModel,
  'shipChoices' | 'availableActions' | 'selectedChoiceIdBySourceInstanceId'
> {
  const group = getNamedGroupSpec('ap.build.ships_that_build.xenite', 0);
  const sourceInstanceId = 'sac-gallery-1';

  return buildShipChoiceFixture({
    groups: [
      {
        heading: group.heading,
        ships: [
          makeShipChoiceInstance({
            shipDefId: group.ships[0].shipDefId,
            buttons: group.ships[0].buttons,
            sourceInstanceId,
            availableChoiceIds: ['destroy', 'hold'],
          }),
        ],
      },
    ],
    selectedChoices: [[sourceInstanceId, 'destroy']],
  });
}

function buildHumanFirstStrikeFixture(): Pick<
  ActionPanelViewModel,
  'shipChoices' | 'availableActions' | 'selectedChoiceIdBySourceInstanceId'
> {
  const group = getCountedGroupSpec('ap.battle.first_strike.human', 0);
  const guardianA = makeShipChoiceInstance({
    shipDefId: group.shipDefId,
    buttons: group.buttons,
    sourceInstanceId: 'gua-gallery-1',
    availableChoiceIds: ['destroy', 'hold'],
    currentCharges: 1,
  });
  const guardianB = makeShipChoiceInstance({
    shipDefId: group.shipDefId,
    buttons: group.buttons,
    sourceInstanceId: 'gua-gallery-2',
    availableChoiceIds: ['destroy', 'hold'],
    currentCharges: 1,
  });

  return buildShipChoiceFixture({
    groups: [
      {
        heading: formatCountedHeading(group, 2),
        ships: [guardianA, guardianB],
      },
    ],
    selectedChoices: [
      ['gua-gallery-1', 'destroy'],
      ['gua-gallery-2', 'hold'],
    ],
  });
}

function buildHumanChargesFixture(): Pick<
  ActionPanelViewModel,
  'shipChoices' | 'availableActions' | 'selectedChoiceIdBySourceInstanceId'
> {
  const group = getCountedGroupSpec('ap.battle.charges.human', 0);

  return buildShipChoiceFixture({
    groups: [
      {
        heading: formatCountedHeading(group, 3),
        ships: [
          makeShipChoiceInstance({
            shipDefId: group.shipDefId,
            buttons: group.buttons,
            sourceInstanceId: 'int-human-a',
            availableChoiceIds: ['damage', 'heal', 'hold'],
            currentCharges: 1,
          }),
          makeShipChoiceInstance({
            shipDefId: group.shipDefId,
            buttons: group.buttons,
            sourceInstanceId: 'int-human-b',
            availableChoiceIds: ['damage', 'hold'],
            currentCharges: 1,
          }),
          makeShipChoiceInstance({
            shipDefId: group.shipDefId,
            buttons: group.buttons,
            sourceInstanceId: 'int-human-c',
            availableChoiceIds: ['heal', 'hold'],
            currentCharges: 1,
          }),
        ],
      },
    ],
    selectedChoices: [
      ['int-human-a', 'damage'],
      ['int-human-b', 'hold'],
      ['int-human-c', 'heal'],
    ],
    showOpponentAlsoHasCharges: true,
    opponentEligibleAtDeclarationStart: true,
  });
}

function buildXeniteChargesFixture(): Pick<
  ActionPanelViewModel,
  'shipChoices' | 'availableActions' | 'selectedChoiceIdBySourceInstanceId'
> {
  const group = getCountedGroupSpec('ap.battle.charges.xenite', 0);

  return buildShipChoiceFixture({
    groups: [
      {
        heading: formatCountedHeading(group, 2),
        ships: [
          makeShipChoiceInstance({
            shipDefId: group.shipDefId,
            buttons: group.buttons,
            sourceInstanceId: 'ant-xenite-a',
            availableChoiceIds: ['damage', 'heal', 'hold'],
            currentCharges: 1,
          }),
          makeShipChoiceInstance({
            shipDefId: group.shipDefId,
            buttons: group.buttons,
            sourceInstanceId: 'ant-xenite-b',
            availableChoiceIds: ['damage', 'hold'],
            currentCharges: 1,
          }),
        ],
      },
    ],
    selectedChoices: [
      ['ant-xenite-a', 'heal'],
      ['ant-xenite-b', 'damage'],
    ],
    showOpponentAlsoHasCharges: true,
    opponentEligibleAtDeclarationStart: true,
  });
}

function buildCentaurChargesFixture(): Pick<
  ActionPanelViewModel,
  'shipChoices' | 'availableActions' | 'selectedChoiceIdBySourceInstanceId'
> {
  const wisGroup = getCountedGroupSpec('ap.battle.charges.centaur', 0);
  const famGroup = getCountedGroupSpec('ap.battle.charges.centaur', 1);
  const intGroup = getCountedGroupSpec('ap.battle.charges.centaur', 2);
  const antGroup = getCountedGroupSpec('ap.battle.charges.centaur', 3);

  return buildShipChoiceFixture({
    groups: [
      {
        heading: formatCountedHeading(wisGroup, 1),
        ships: [
          makeShipChoiceInstance({
            shipDefId: wisGroup.shipDefId,
            buttons: wisGroup.buttons,
            sourceInstanceId: 'wis-centaur-a',
            availableChoiceIds: ['damage', 'heal', 'hold'],
            currentCharges: 2,
            internalTab: wisGroup.internalTab,
          }),
        ],
      },
      {
        heading: formatCountedHeading(famGroup, 1),
        ships: [
          makeShipChoiceInstance({
            shipDefId: famGroup.shipDefId,
            buttons: famGroup.buttons,
            sourceInstanceId: 'fam-centaur-a',
            availableChoiceIds: ['damage', 'heal', 'hold'],
            currentCharges: 3,
            internalTab: famGroup.internalTab,
          }),
        ],
      },
      {
        heading: formatCountedHeading(intGroup, 1),
        ships: [
          makeShipChoiceInstance({
            shipDefId: intGroup.shipDefId,
            buttons: intGroup.buttons,
            sourceInstanceId: 'int-centaur-a',
            availableChoiceIds: ['damage', 'hold'],
            currentCharges: 1,
            internalTab: intGroup.internalTab,
          }),
        ],
      },
      {
        heading: formatCountedHeading(antGroup, 1),
        ships: [
          makeShipChoiceInstance({
            shipDefId: antGroup.shipDefId,
            buttons: antGroup.buttons,
            sourceInstanceId: 'ant-centaur-a',
            availableChoiceIds: ['heal', 'hold'],
            currentCharges: 1,
            internalTab: antGroup.internalTab,
          }),
        ],
      },
    ],
    selectedChoices: [
      ['wis-centaur-a', 'heal'],
      ['fam-centaur-a', 'damage'],
      ['int-centaur-a', 'hold'],
      ['ant-centaur-a', 'heal'],
    ],
    showOpponentAlsoHasCharges: true,
    opponentEligibleAtDeclarationStart: true,
    centaurChargeTabs: {
      activeTab: 'charges',
      availableTabs: ['charges', 'ship_of_equality'],
    },
  });
}

function buildCentaurEqualityChargesFixture(): Pick<
  ActionPanelViewModel,
  'shipChoices' | 'availableActions' | 'selectedChoiceIdBySourceInstanceId'
> {
  const group = getCountedGroupSpec('ap.battle.charges.centaur.ship_of_equality', 0);

  return buildShipChoiceFixture({
    groups: [
      {
        heading: formatCountedHeading(group, 2),
        groupHelpText: group.groupHelpText,
        ships: [
          makeShipChoiceInstance({
            shipDefId: group.shipDefId,
            buttons: group.buttons,
            sourceInstanceId: 'equ-centaur-a',
            availableChoiceIds: ['damage', 'hold'],
            currentCharges: 2,
            internalTab: 'ship_of_equality',
          }),
          makeShipChoiceInstance({
            shipDefId: group.shipDefId,
            buttons: group.buttons,
            sourceInstanceId: 'equ-centaur-b',
            availableChoiceIds: ['hold'],
            currentCharges: 1,
            internalTab: 'ship_of_equality',
          }),
        ],
      },
    ],
    selectedChoices: [
      ['equ-centaur-a', 'damage'],
      ['equ-centaur-b', 'hold'],
    ],
    showOpponentAlsoHasCharges: true,
    opponentEligibleAtDeclarationStart: true,
    centaurChargeTabs: {
      activeTab: 'ship_of_equality',
      availableTabs: ['charges', 'ship_of_equality'],
    },
  });
}

function buildShipChoicePanelFixture(
  panelId: ActionPanelId
): Pick<ActionPanelViewModel, 'shipChoices' | 'availableActions' | 'selectedChoiceIdBySourceInstanceId'> | null {
  switch (panelId) {
    case 'ap.build.dice_roll.centaur':
      return buildCentaurDiceRollFixture();
    case 'ap.build.ships_that_build.human':
      return buildHumanShipsThatBuildFixture();
    case 'ap.build.ships_that_build.centaur.mixed':
      return buildCentaurShipsThatBuildFixture();
    case 'ap.build.ships_that_build.xenite':
      return buildXeniteShipsThatBuildFixture();
    case 'ap.battle.first_strike.human':
      return buildHumanFirstStrikeFixture();
    case 'ap.battle.charges.human':
      return buildHumanChargesFixture();
    case 'ap.battle.charges.xenite':
      return buildXeniteChargesFixture();
    case 'ap.battle.charges.centaur':
      return buildCentaurChargesFixture();
    case 'ap.battle.charges.centaur.ship_of_equality':
      return buildCentaurEqualityChargesFixture();
    default:
      return null;
  }
}

function buildLargeChoicePanelFixture(
  panelId: ActionPanelId
): ActionPanelViewModel['largeChoicePanel'] | undefined {
  switch (panelId) {
    case 'ap.battle.first_strike.centaur':
      return {
        instruction: 'Static gallery example: select two basic enemy ships to steal.',
      };
    case 'ap.battle.charges.ancient.black_hole':
      return {
        instruction: 'Static gallery example: select two basic enemy ships for Black Hole.',
      };
    case 'ap.battle.charges.ancient.simulacrum':
      return {
        instruction: 'Static gallery example: select a basic enemy ship to copy.',
      };
    default:
      return undefined;
  }
}

function getCatalogueFixture(panelId: ActionPanelId): ActionPanelViewModel['buildCatalogue'] {
  return panelId === 'ap.catalog.ships.ancient'
    ? REFERENCE_ONLY_CATALOGUE_FIXTURE
    : BUILDABLE_CATALOGUE_FIXTURE;
}

function buildGalleryVm(panelId: ActionPanelId): ActionPanelViewModel {
  const base: ActionPanelViewModel = {
    activePanelId: panelId,
    tabs: DUMMY_TABS,
    buildCatalogue: getCatalogueFixture(panelId),
    menu: MENU_FIXTURE,
    availableActions: [],
    selectedChoiceIdBySourceInstanceId: {},
  };

  const shipChoiceFixture = buildShipChoicePanelFixture(panelId);
  if (shipChoiceFixture) {
    return {
      ...base,
      ...shipChoiceFixture,
    };
  }

  if (panelId === 'ap.build.drawing.human') {
    return {
      ...base,
      frigateDrawing: FRIGATE_DRAWING_FIXTURE,
    };
  }

  if (panelId === 'ap.build.drawing.xenite') {
    return {
      ...base,
      evolverDrawing: EVOLVER_DRAWING_FIXTURE,
    };
  }

  if (panelId === 'ap.end_of_game.result') {
    return {
      ...base,
      endOfGame: END_OF_GAME_FIXTURE,
    };
  }

  const largeChoicePanel = buildLargeChoicePanelFixture(panelId);
  if (largeChoicePanel) {
    return {
      ...base,
      largeChoicePanel,
    };
  }

  return base;
}

export function ActionPanelsGallery() {
  return (
    <div className="w-full">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Action Panels Gallery</h2>
        <p className="mt-1 text-sm text-gray-600">
          Static contract-current action panel fixtures rendered through the real panel frame.
        </p>
      </div>

      {ACTION_PANEL_IDS.map((panelId) => {
        const vm = buildGalleryVm(panelId);

        return (
          <div key={panelId} className="space-y-2">
            <div className="flex items-baseline gap-3">
              <h3 className="text-sm font-mono font-semibold text-gray-700">{panelId}</h3>
              <span className="text-xs text-gray-500">
                {ACTION_PANEL_DISPLAY_NAMES[panelId]}
              </span>
            </div>

            <div className="w-full rounded-md bg-black p-5">
              <div className="min-h-[300px] w-full">
                <ActionPanelFrame
                  vm={vm}
                  actions={DUMMY_ACTIONS}
                  onReturnToMainMenu={NOOP}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
