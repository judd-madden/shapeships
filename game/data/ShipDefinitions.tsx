// Ship Definitions - Auto-generated from CSV
// Generated: 2024-12-23
// Total Ships: 70
// DO NOT EDIT MANUALLY - Regenerate using: npx tsx scripts/generateShipFiles.ts

import type { ShipDefinition } from '../types/ShipTypes';
import { 
  ShipType, 
  Species, 
  ShipPowerPhase,
  PowerTiming,
  PowerEffectType
} from '../types/ShipTypes';

// Import all ship graphics
import {
  DefenderShip,
  FighterShip,
  CommanderShip,
  InterceptorShip1,
  InterceptorShip0,
  OrbitalShip,
  CarrierShip6,
  CarrierShip5,
  CarrierShip4,
  CarrierShip3,
  CarrierShip2,
  CarrierShip1,
  CarrierShip0,
  StarshipShip,
  FrigateShip,
  TacticalCruiserShip,
  GuardianShip2,
  GuardianShip1,
  GuardianShip0,
  ScienceVesselShip,
  BattlecruiserShip,
  EarthShip,
  DreadnoughtShip,
  LeviathanShip
} from '../../graphics/human/assets';

import {
  XeniteShip,
  AntlionShip1,
  AntlionShip0,
  MantisShip,
  EvolverShip,
  OxiteShip,
  AsteriteShip,
  HellHornetShip,
  BugBreeder4Ship,
  BugBreeder3Ship,
  BugBreeder2Ship,
  BugBreeder1Ship,
  BugBreederDepletedShip,
  ZenithShip,
  DefenseSwarmShip,
  AntlionArrayShip,
  OxiteFaceShip,
  AsteriteFaceShip,
  SacrificialPoolShip,
  QueenShip,
  ChronoswarmShip,
  HiveShip
} from '../../graphics/xenite/assets';

import {
  ShipOfFearShip,
  ShipOfAngerShip,
  ShipOfEquality2Ship,
  ShipOfEquality1Ship,
  ShipOfEquality0Ship,
  ShipOfWisdom2Ship,
  ShipOfWisdom1Ship,
  ShipOfWisdom0Ship,
  ShipOfVigorShip,
  ShipOfFamily3Ship,
  ShipOfFamily2Ship,
  ShipOfFamily1Ship,
  ShipOfFamily0Ship,
  ShipOfLegacyShip,
  ArkOfTerrorShip,
  ArkOfFuryShip,
  ArkOfKnowledgeShip,
  ArkOfEntropyShip,
  ArkOfRedemptionShip,
  ArkOfPowerShip,
  ArkOfDestructionShip,
  ArkOfDominationShip
} from '../../graphics/centaur/assets';

import {
  MercuryCore,
  PlutoCore,
  QuantumMystic,
  Spiral,
  UranusCore,
  SolarReserve4,
  SolarReserve3,
  SolarReserve2,
  SolarReserve1,
  SolarReserve0,
  Cube
} from '../../graphics/ancient/assets';

// ============================================================================
// SHIP DEFINITIONS (70 ships)
// ============================================================================

export const SHIP_DEFINITIONS: ShipDefinition[] = [
  // HUMAN - Basic Ships (8)
  {
    id: 'DEF',
    name: 'Defender',
    species: Species.HUMAN,
    type: ShipType.BASIC,
    color: 'Pastel Green',
    basicCost: { lines: 2 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.HEAL,
      baseAmount: 1,
      description: 'Heal 1.'
    }],
    graphics: [{ component: DefenderShip, condition: 'default' }]
  },

  {
    id: 'FIG',
    name: 'Fighter',
    species: Species.HUMAN,
    type: ShipType.BASIC,
    color: 'Pastel Red',
    basicCost: { lines: 3 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.DEAL_DAMAGE,
      baseAmount: 1,
      description: 'Deal 1 damage.'
    }],
    graphics: [{ component: FighterShip, condition: 'default' }]
  },

  {
    id: 'COM',
    name: 'Commander',
    species: Species.HUMAN,
    type: ShipType.BASIC,
    color: 'Pastel Orange',
    basicCost: { lines: 4 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.COUNT_AND_DAMAGE,
      baseAmount: 1,
      description: 'Deal 1 damage for every THREE of your Fighters.',
      specialLogic: {
        countType: 'specific_ship_type',
        countTarget: 'FIG',
        countMultiplier: 3
      }
    }],
    graphics: [{ component: CommanderShip, condition: 'default' }]
  },

  {
    id: 'INT',
    name: 'Interceptor',
    species: Species.HUMAN,
    type: ShipType.BASIC,
    color: 'Pastel Purple',
    basicCost: { lines: 4 },
    maxCharges: 1,
    powers: [
      {
        powerIndex: 1,
        phase: ShipPowerPhase.SIMULTANEOUS_DECLARATION,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.HEAL,
        baseAmount: 5,
        description: 'Heal 5 (use 1 charge).',
        requiresCharge: true
      },
      {
        powerIndex: 2,
        phase: ShipPowerPhase.SIMULTANEOUS_DECLARATION,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.DEAL_DAMAGE,
        baseAmount: 5,
        description: 'Deal 5 damage (use 1 charge)',
        requiresCharge: true
      }
    ],
    rulesNotes: 'Can hold charge.',
    graphics: [
      { component: InterceptorShip1, condition: 'default' },
      { component: InterceptorShip0, condition: 'charges_depleted' }
    ]
  },

  {
    id: 'ORB',
    name: 'Orbital',
    species: Species.HUMAN,
    type: ShipType.BASIC,
    color: 'Pastel Blue',
    basicCost: { lines: 6 },
    maxQuantity: 6,
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.LINE_GENERATION,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.GAIN_LINES,
      baseAmount: 1,
      description: 'Generate an additional line in each future build phase.'
    }],
    rulesNotes: 'You can have a maximum of 6 Orbitals. Lines may be saved.',
    graphics: [{ component: OrbitalShip, condition: 'default' }]
  },

  {
    id: 'CAR',
    name: 'Carrier',
    species: Species.HUMAN,
    type: ShipType.BASIC,
    color: 'Pastel Yellow',
    basicCost: { lines: 6 },
    maxCharges: 6,
    powers: [
      {
        powerIndex: 1,
        phase: ShipPowerPhase.SHIPS_THAT_BUILD,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.BUILD_SHIP,
        baseAmount: 1,
        description: 'Make a Defender (use 1 charge).',
        requiresCharge: true,
        specialLogic: {
          buildShipId: 'DEF'
        }
      },
      {
        powerIndex: 2,
        phase: ShipPowerPhase.SHIPS_THAT_BUILD,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.BUILD_SHIP,
        baseAmount: 1,
        description: 'Make a Fighter (use 2 charges)',
        requiresCharge: true,
        specialLogic: {
          buildShipId: 'FIG',
          chargesRequired: 2
        }
      }
    ],
    rulesNotes: 'Can only use one power once per subphase. System: notated with CAR(X) where X is remaining charges',
    graphics: [
      { component: CarrierShip6, condition: 'charges_6' },
      { component: CarrierShip5, condition: 'charges_5' },
      { component: CarrierShip4, condition: 'charges_4' },
      { component: CarrierShip3, condition: 'charges_3' },
      { component: CarrierShip2, condition: 'charges_2' },
      { component: CarrierShip1, condition: 'charges_1' },
      { component: CarrierShip0, condition: 'charges_depleted' }
    ]
  },

  {
    id: 'STA',
    name: 'Starship',
    species: Species.HUMAN,
    type: ShipType.BASIC,
    color: 'Pastel Pink',
    basicCost: { lines: 8 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.ONCE_ONLY_AUTOMATIC,
      effectType: PowerEffectType.DEAL_DAMAGE,
      baseAmount: 8,
      description: 'Deal 8 damage, once only on the turn it is built.',
      specialLogic: {
        customLogicId: 'once_only_on_build'
      }
    }],
    graphics: [{ component: StarshipShip, condition: 'default' }]
  },

  // HUMAN - Upgraded Ships (8)
  {
    id: 'FRI',
    name: 'Frigate',
    species: Species.HUMAN,
    type: ShipType.UPGRADED,
    color: 'Yellow',
    upgradedCost: {
      totalLines: 8,
      joiningLines: 3,
      componentShips: [
        { shipId: 'DEF', quantity: 1 },
        { shipId: 'FIG', quantity: 1 }
      ]
    },
    powers: [
      {
        powerIndex: 1,
        phase: ShipPowerPhase.DRAWING,
        timing: PowerTiming.ONCE_ONLY_AUTOMATIC,
        effectType: PowerEffectType.CUSTOM,
        description: 'Choose a trigger number for this ship, 1-6.',
        requiresPlayerChoice: true,
        choiceType: 'trigger_number',
        specialLogic: {
          customLogicId: 'frigate_choose_trigger'
        }
      },
      {
        powerIndex: 2,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.CONDITIONAL,
        baseAmount: 6,
        description: 'If dice roll matches the trigger number, deal 6 damage. Including the turn this is built.',
        specialLogic: {
          customLogicId: 'frigate_conditional_damage',
          conditionType: 'dice_value'
        }
      },
      {
        powerIndex: 3,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.HEAL,
        baseAmount: 2,
        description: 'Heal 2'
      }
    ],
    graphics: [{ component: FrigateShip, condition: 'default' }]
  },

  {
    id: 'TAC',
    name: 'Tactical Cruiser',
    species: Species.HUMAN,
    type: ShipType.UPGRADED,
    color: 'Orange',
    upgradedCost: {
      totalLines: 10,
      joiningLines: 3,
      componentShips: [
        { shipId: 'DEF', quantity: 2 },
        { shipId: 'FIG', quantity: 1 }
      ]
    },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.COUNT_AND_DAMAGE,
      baseAmount: 1,
      description: 'Deal 1 damage for each TYPE of ship you have.',
      specialLogic: {
        countType: 'ship_types',
        countMultiplier: 1
      }
    }],
    rulesNotes: 'Includes Tactical Cruiser as a type. TYPE are counted during End of Turn Resolution.',
    graphics: [{ component: TacticalCruiserShip, condition: 'default' }]
  },

  {
    id: 'GUA',
    name: 'Guardian',
    species: Species.HUMAN,
    type: ShipType.UPGRADED,
    color: 'Blue',
    upgradedCost: {
      totalLines: 12,
      joiningLines: 4,
      componentShips: [
        { shipId: 'DEF', quantity: 2 },
        { shipId: 'COM', quantity: 1 }
      ]
    },
    maxCharges: 2,
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.FIRST_STRIKE,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.DESTROY_SHIP,
      baseAmount: 1,
      description: 'Destroy a basic enemy ship (use 1 charge).',
      requiresCharge: true,
      requiresPlayerChoice: true,
      choiceType: 'target_selection',
      specialLogic: {
        targetType: 'basic_only'
      }
    }],
    graphics: [
      { component: GuardianShip2, condition: 'charges_2' },
      { component: GuardianShip1, condition: 'charges_1' },
      { component: GuardianShip0, condition: 'charges_depleted' }
    ]
  },

  {
    id: 'SCI',
    name: 'Science Vessel',
    species: Species.HUMAN,
    type: ShipType.UPGRADED,
    color: 'Pink',
    upgradedCost: {
      totalLines: 17,
      joiningLines: 4,
      componentShips: [
        { shipId: 'DEF', quantity: 1 },
        { shipId: 'FIG', quantity: 1 },
        { shipId: 'STA', quantity: 1 }
      ]
    },
    powers: [
      {
        powerIndex: 1,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.CUSTOM,
        description: 'If you have 1 Science Vessel: Double your Automatic healing.',
        specialLogic: {
          customLogicId: 'science_vessel_scaling',
          scalingType: 'by_quantity',
          scalingValues: [
            { quantity: 1, effect: 'double_automatic_healing' }
          ]
        }
      },
      {
        powerIndex: 2,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.CUSTOM,
        description: 'If you have 2 Science Vessels: Double your Automatic damage.',
        specialLogic: {
          customLogicId: 'science_vessel_scaling',
          scalingType: 'by_quantity',
          scalingValues: [
            { quantity: 2, effect: 'double_automatic_damage' }
          ]
        }
      },
      {
        powerIndex: 3,
        phase: ShipPowerPhase.LINE_GENERATION,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.CUSTOM,
        description: 'If you have 3 Science Vessels: Generate additional lines equal to the dice roll.',
        specialLogic: {
          customLogicId: 'science_vessel_scaling',
          scalingType: 'by_quantity',
          scalingValues: [
            { quantity: 3, effect: 'lines_equal_dice' }
          ]
        }
      }
    ],
    graphics: [{ component: ScienceVesselShip, condition: 'default' }]
  },

  {
    id: 'BAT',
    name: 'Battle Cruiser',
    species: Species.HUMAN,
    type: ShipType.UPGRADED,
    color: 'Cyan',
    upgradedCost: {
      totalLines: 20,
      joiningLines: 6,
      componentShips: [
        { shipId: 'DEF', quantity: 1 },
        { shipId: 'FIG', quantity: 2 },
        { shipId: 'ORB', quantity: 1 }
      ]
    },
    powers: [
      {
        powerIndex: 1,
        phase: ShipPowerPhase.LINE_GENERATION,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.GAIN_LINES,
        baseAmount: 2,
        description: 'Generate 2 additional lines in each future build phase.'
      },
      {
        powerIndex: 2,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.HEAL,
        baseAmount: 3,
        description: 'Heal 3.'
      },
      {
        powerIndex: 3,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.DEAL_DAMAGE,
        baseAmount: 2,
        description: 'Deal 2 damage.'
      }
    ],
    graphics: [{ component: BattlecruiserShip, condition: 'default' }]
  },

  {
    id: 'EAR',
    name: 'Earth Ship',
    species: Species.HUMAN,
    type: ShipType.UPGRADED,
    color: 'Green',
    upgradedCost: {
      totalLines: 23,
      joiningLines: 7,
      componentShips: [
        { shipId: 'DEF', quantity: 2 },
        { shipId: 'ORB', quantity: 1 },
        { shipId: 'CAR', quantity: 1, mustBeDepleted: true }
      ]
    },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.COUNT_AND_DAMAGE,
      baseAmount: 3,
      description: 'Deal 3 damage for each of your Carriers.',
      specialLogic: {
        countType: 'specific_ship_type',
        countTarget: 'CAR',
        countMultiplier: 1
      }
    }],
    graphics: [{ component: EarthShip, condition: 'default' }]
  },

  {
    id: 'DRE',
    name: 'Dreadnought',
    species: Species.HUMAN,
    type: ShipType.UPGRADED,
    color: 'Red',
    upgradedCost: {
      totalLines: 27,
      joiningLines: 10,
      componentShips: [
        { shipId: 'DEF', quantity: 2 },
        { shipId: 'FIG', quantity: 3 },
        { shipId: 'COM', quantity: 1 }
      ]
    },
    powers: [
      {
        powerIndex: 1,
        phase: ShipPowerPhase.DRAWING,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.BUILD_SHIP,
        baseAmount: 1,
        description: 'When you complete a ship, you may make a FREE additional Fighter.',
        specialLogic: {
          customLogicId: 'dreadnought_trigger',
          triggerEvent: 'on_ship_completed',
          buildShipId: 'FIG'
        }
      },
      {
        powerIndex: 2,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.DEAL_DAMAGE,
        baseAmount: 10,
        description: 'Deal 10 damage.'
      }
    ],
    rulesNotes: 'The Dreadnought\'s build power activates whenever you make a basic ship (including from Carriers) or complete an upgraded ship. It can occur multiple times per turn. Is not activated by itself or other Dreadnoughts.',
    graphics: [{ component: DreadnoughtShip, condition: 'default' }]
  },

  {
    id: 'LEV',
    name: 'Leviathan',
    species: Species.HUMAN,
    type: ShipType.UPGRADED,
    color: 'Purple',
    upgradedCost: {
      totalLines: 44,
      joiningLines: 12,
      componentShips: [
        { shipId: 'DEF', quantity: 2 },
        { shipId: 'CAR', quantity: 2, mustBeDepleted: true },
        { shipId: 'STA', quantity: 2 }
      ]
    },
    powers: [
      {
        powerIndex: 1,
        phase: ShipPowerPhase.DICE_MANIPULATION,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.FORCE_DICE_VALUE,
        baseAmount: 6,
        description: 'All dice rolls read as 6 for you.',
        specialLogic: {
          customLogicId: 'leviathan_force_dice',
          diceManipulation: 'force_value',
          forcedDiceValue: 6
        }
      },
      {
        powerIndex: 2,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.DEAL_DAMAGE,
        baseAmount: 12,
        description: 'Deal 12 damage.'
      },
      {
        powerIndex: 3,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.HEAL,
        baseAmount: 12,
        description: 'Heal 12.'
      }
    ],
    rulesNotes: 'Carrier charges must all be used before upgrading. Overrides reroll powers.',
    graphics: [{ component: LeviathanShip, condition: 'default' }]
  },

  // XENITE - Basic Ships (9)
  {
    id: 'XEN',
    name: 'Xenite',
    species: Species.XENITE,
    type: ShipType.BASIC,
    color: 'White',
    basicCost: { lines: 2 },
    powers: [],
    graphics: [{ component: XeniteShip, condition: 'default' }]
  },

  {
    id: 'ANT',
    name: 'Antlion',
    species: Species.XENITE,
    type: ShipType.BASIC,
    color: 'Pastel Orange',
    basicCost: { lines: 3 },
    maxCharges: 1,
    powers: [
      {
        powerIndex: 1,
        phase: ShipPowerPhase.SIMULTANEOUS_DECLARATION,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.HEAL,
        baseAmount: 3,
        description: 'Heal 3 (use 1 charge).',
        requiresCharge: true
      },
      {
        powerIndex: 2,
        phase: ShipPowerPhase.SIMULTANEOUS_DECLARATION,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.DEAL_DAMAGE,
        baseAmount: 3,
        description: 'Deal 3 damage (use 1 charge).',
        requiresCharge: true
      }
    ],
    rulesNotes: 'Can hold charge.',
    graphics: [
      { component: AntlionShip1, condition: 'default' },
      { component: AntlionShip0, condition: 'charges_depleted' }
    ]
  },

  {
    id: 'MAN',
    name: 'Mantis',
    species: Species.XENITE,
    type: ShipType.BASIC,
    color: 'Pastel Green',
    basicCost: { lines: 4 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.COUNT_AND_HEAL,
      baseAmount: 1,
      description: 'Heal 1 for every TWO of your Xenites.',
      specialLogic: {
        countType: 'specific_ship_type',
        countTarget: 'XEN',
        countMultiplier: 2
      }
    }],
    rulesNotes: 'Each Mantis can heal a maximum of 10 per turn.',
    graphics: [{ component: MantisShip, condition: 'default' }]
  },

  {
    id: 'EVO',
    name: 'Evolver',
    species: Species.XENITE,
    type: ShipType.BASIC,
    color: 'Pastel Purple',
    basicCost: { lines: 4 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.DRAWING,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.CUSTOM,
      description: 'When built and in each future build phase, may turn one Xenite into an Oxite or an Asterite.',
      requiresPlayerChoice: true,
      choiceType: 'ship_transformation',
      specialLogic: {
        customLogicId: 'evolver_transform',
        sourceShipId: 'XEN',
        targetShipOptions: ['OXI', 'AST']
      }
    }],
    rulesNotes: 'If no Xenites available power cannot be used.',
    graphics: [{ component: EvolverShip, condition: 'default' }]
  },

  {
    id: 'OXI',
    name: 'Oxite',
    species: Species.XENITE,
    type: ShipType.BASIC,
    color: 'White',
    basicCost: { lines: 2 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.HEAL,
      baseAmount: 1,
      description: 'Heal 1.'
    }],
    graphics: [{ component: OxiteShip, condition: 'default' }]
  },

  {
    id: 'AST',
    name: 'Asterite',
    species: Species.XENITE,
    type: ShipType.BASIC,
    color: 'White',
    basicCost: { lines: 2 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.DEAL_DAMAGE,
      baseAmount: 1,
      description: 'Deal 1 damage.'
    }],
    graphics: [{ component: AsteriteShip, condition: 'default' }]
  },

  {
    id: 'HEL',
    name: 'Hell Hornet',
    species: Species.XENITE,
    type: ShipType.BASIC,
    color: 'Pastel Red',
    basicCost: { lines: 6 },
    powers: [
      {
        powerIndex: 1,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.ONCE_ONLY_AUTOMATIC,
        effectType: PowerEffectType.DEAL_DAMAGE,
        baseAmount: 3,
        description: 'Deal 3 damage, once only on the turn it is built.',
        specialLogic: {
          customLogicId: 'once_only_on_build'
        }
      },
      {
        powerIndex: 2,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.COUNT_AND_DAMAGE,
        baseAmount: 1,
        description: 'Deal 1 damage for every TWO of your Xenites.',
        specialLogic: {
          countType: 'specific_ship_type',
          countTarget: 'XEN',
          countMultiplier: 2
        }
      }
    ],
    graphics: [{ component: HellHornetShip, condition: 'default' }]
  },

  {
    id: 'BUG',
    name: 'Bug Breeder',
    species: Species.XENITE,
    type: ShipType.BASIC,
    color: 'Pastel Blue',
    basicCost: { lines: 6 },
    maxCharges: 4,
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.SHIPS_THAT_BUILD,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.BUILD_SHIP,
      baseAmount: 1,
      description: 'Make a Xenite (use 1 charge).',
      requiresCharge: true,
      specialLogic: {
        buildShipId: 'XEN'
      }
    }],
    graphics: [
      { component: BugBreeder4Ship, condition: 'charges_4' },
      { component: BugBreeder3Ship, condition: 'charges_3' },
      { component: BugBreeder2Ship, condition: 'charges_2' },
      { component: BugBreeder1Ship, condition: 'charges_1' },
      { component: BugBreederDepletedShip, condition: 'charges_depleted' }
    ]
  },

  {
    id: 'ZEN',
    name: 'Zenith',
    species: Species.XENITE,
    type: ShipType.BASIC,
    color: 'Pastel Yellow',
    basicCost: { lines: 9 },
    powers: [
      {
        powerIndex: 1,
        phase: ShipPowerPhase.DRAWING,
        timing: PowerTiming.ONCE_ONLY_AUTOMATIC,
        effectType: PowerEffectType.BUILD_SHIP,
        baseAmount: 1,
        description: 'When built, make an Antlion.',
        specialLogic: {
          customLogicId: 'zenith_build_antlion',
          buildShipId: 'ANT'
        }
      },
      {
        powerIndex: 2,
        phase: ShipPowerPhase.SHIPS_THAT_BUILD,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.CONDITIONAL,
        description: 'Each future build phase: If dice roll is a 2, make a Xenite. If dice roll is a 3, make an Antlion. If dice roll is a 4, make two Xenites.',
        specialLogic: {
          customLogicId: 'zenith_dice_conditional',
          conditionType: 'dice_value',
          conditionalEffects: [
            { diceValue: 2, buildShipId: 'XEN', quantity: 1 },
            { diceValue: 3, buildShipId: 'ANT', quantity: 1 },
            { diceValue: 4, buildShipId: 'XEN', quantity: 2 }
          ]
        }
      },
      {
        powerIndex: 3,
        phase: ShipPowerPhase.EVENT,  // EVENT, not UPON_DESTRUCTION - this is a hook, not a phase
        timing: PowerTiming.UPON_DESTRUCTION,
        effectType: PowerEffectType.BUILD_SHIP,
        baseAmount: 3,  // ✅ FIXED: Was 2, should be 3
        description: 'Upon destruction, make three Xenites.',
        specialLogic: {
          customLogicId: 'zenith_upon_destruction',
          triggerEvent: 'on_ship_destroyed',  // Explicit: timing comes from event, not phase traversal
          buildShipId: 'XEN',
          persistsIfSourceDestroyed: true
        }
      }
    ],
    graphics: [{ component: ZenithShip, condition: 'default' }]
  },

  // XENITE - Upgraded Ships (7)
  {
    id: 'DSW',
    name: 'Defense Swarm',
    species: Species.XENITE,
    type: ShipType.UPGRADED,
    color: 'Green',
    upgradedCost: {
      totalLines: 9,
      joiningLines: 3,
      componentShips: [
        { shipId: 'XEN', quantity: 3 }
      ]
    },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.CONDITIONAL,
      baseAmount: 3,
      description: 'Heal 3 OR At the start of this turn, if your health is lower than your opponent\'s health: Heal 7.',
      requiresPlayerChoice: true,
      choiceType: 'or_choice',
      specialLogic: {
        customLogicId: 'defense_swarm_conditional_heal',
        conditionType: 'health_comparison',
        defaultAmount: 3,
        conditionalAmount: 7
      }
    }],
    graphics: [{ component: DefenseSwarmShip, condition: 'default' }]
  },

  {
    id: 'AAR',
    name: 'Antlion Array',
    species: Species.XENITE,
    type: ShipType.UPGRADED,
    color: 'Orange',
    upgradedCost: {
      totalLines: 12,
      joiningLines: 3,
      componentShips: [
        { shipId: 'ANT', quantity: 3, mustBeDepleted: true }
      ]
    },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.CONDITIONAL,
      baseAmount: 3,
      description: 'Deal 3 damage OR At the start of this turn, if your health is lower than your opponent\'s health: Deal 7 damage.',
      requiresPlayerChoice: true,
      choiceType: 'or_choice',
      specialLogic: {
        customLogicId: 'antlion_array_conditional_damage',
        conditionType: 'health_comparison',
        defaultAmount: 3,
        conditionalAmount: 7
      }
    }],
    graphics: [{ component: AntlionArrayShip, condition: 'default' }]
  },

  {
    id: 'OXF',
    name: 'Oxite Face',
    species: Species.XENITE,
    type: ShipType.UPGRADED,
    color: 'Yellow',
    upgradedCost: {
      totalLines: 12,
      joiningLines: 4,
      componentShips: [
        { shipId: 'OXI', quantity: 2 },
        { shipId: 'EVO', quantity: 1 }
      ]
    },
    powers: [
      {
        powerIndex: 1,
        phase: ShipPowerPhase.LINE_GENERATION,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.GAIN_LINES,
        baseAmount: 1,
        description: 'Generate an additional line in each future build phase.'
      },
      {
        powerIndex: 2,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.COUNT_AND_HEAL,
        baseAmount: 1,
        description: 'Heal 1 for each TYPE of ship your opponent has.',
        specialLogic: {
          countType: 'opponent_ship_types',
          countMultiplier: 1
        }
      }
    ],
    rulesNotes: 'TYPE are counted during End of Turn Resolution.',
    graphics: [{ component: OxiteFaceShip, condition: 'default' }]
  },

  {
    id: 'ASF',
    name: 'Asterite Face',
    species: Species.XENITE,
    type: ShipType.UPGRADED,
    color: 'Blue',
    upgradedCost: {
      totalLines: 12,
      joiningLines: 4,
      componentShips: [
        { shipId: 'AST', quantity: 2 },
        { shipId: 'EVO', quantity: 1 }
      ]
    },
    powers: [
      {
        powerIndex: 1,
        phase: ShipPowerPhase.LINE_GENERATION,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.GAIN_LINES,
        baseAmount: 1,
        description: 'Generate an additional line in each future build phase.'
      },
      {
        powerIndex: 2,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.COUNT_AND_DAMAGE,
        baseAmount: 1,
        description: 'Deal 1 damage for each TYPE of ship your opponent has.',
        specialLogic: {
          countType: 'opponent_ship_types',
          countMultiplier: 1
        }
      }
    ],
    rulesNotes: 'TYPE are counted during End of Turn Resolution.',
    graphics: [{ component: AsteriteFaceShip, condition: 'default' }]
  },

  {
    id: 'SAC',
    name: 'Sacrificial Pool',
    species: Species.XENITE,
    type: ShipType.UPGRADED,
    color: 'Red',
    upgradedCost: {
      totalLines: 12,
      joiningLines: 4,
      componentShips: [
        { shipId: 'XEN', quantity: 1 },
        { shipId: 'ANT', quantity: 2, mustBeDepleted: true }
      ]
    },
    powers: [
      {
        powerIndex: 1,
        phase: ShipPowerPhase.SHIPS_THAT_BUILD,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.CUSTOM,
        description: 'Each future build phase, may destroy one basic ship of yours and make a Xenite for every 3 lines in that ship (round down).',
        requiresPlayerChoice: true,
        choiceType: 'target_selection',
        specialLogic: {
          customLogicId: 'sacrificial_pool_sacrifice',
          sacrificeShip: true,
          buildShipId: 'XEN',
          quantityFormula: 'floor(lines / 3)'
        }
      },
      {
        powerIndex: 2,
        phase: ShipPowerPhase.PASSIVE,
        timing: PowerTiming.PASSIVE,
        effectType: PowerEffectType.CUSTOM,
        description: 'Your ships cannot be destroyed by opponent powers.',
        specialLogic: {
          customLogicId: 'sacrificial_pool_protection',
          passiveModifier: 'prevent_destruction'
        }
      }
    ],
    graphics: [{ component: SacrificialPoolShip, condition: 'default' }]
  },

  {
    id: 'QUE',
    name: 'Queen',
    species: Species.XENITE,
    type: ShipType.UPGRADED,
    color: 'Cyan',
    upgradedCost: {
      totalLines: 20,
      joiningLines: 6,
      componentShips: [
        { shipId: 'XEN', quantity: 1 },
        { shipId: 'ANT', quantity: 2, mustBeDepleted: true },
        { shipId: 'BUG', quantity: 1, mustBeDepleted: true }
      ]
    },
    powers: [
      {
        powerIndex: 1,
        phase: ShipPowerPhase.SHIPS_THAT_BUILD,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.BUILD_SHIP,
        baseAmount: 1,
        description: 'Each future build phase, make a Xenite.',
        specialLogic: {
          customLogicId: 'queen_build_xenite',
          buildShipId: 'XEN'
        }
      },
      {
        powerIndex: 2,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.CUSTOM,
        baseAmount: 3,
        description: 'Deal 3 damage for each ship you made this turn (not including the Xenite from this Queen).',
        specialLogic: {
          customLogicId: 'queen_count_ships_made',
          countType: 'ships_made_this_turn',
          excludeSourceShip: true,
          damagePerShip: 3
        }
      }
    ],
    rulesNotes: 'Damage count includes: drawn ships, upgraded ships, and ships made from other Queens, Bug Breeders, Zeniths, Sacrificial Pools.',
    graphics: [{ component: QueenShip, condition: 'default' }]
  },

  {
    id: 'CHR',
    name: 'Chronoswarm',
    species: Species.XENITE,
    type: ShipType.UPGRADED,
    color: 'Pink',
    upgradedCost: {
      totalLines: 25,
      joiningLines: 4,
      componentShips: [
        { shipId: 'XEN', quantity: 6 },
        { shipId: 'ZEN', quantity: 1 }
      ]
    },
    powers: [
      {
        powerIndex: 1,
        phase: ShipPowerPhase.END_OF_BUILD,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.CUSTOM,
        description: 'Each turn, before the battle phase, you take an extra build phase. (Includes Dice Roll, Ships That Build and Drawing, but not Face lines.)',
        specialLogic: {
          customLogicId: 'chronoswarm_extra_phase',
          extraPhaseType: 'build'
        }
      },
      {
        powerIndex: 2,
        phase: ShipPowerPhase.END_OF_BUILD,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.CUSTOM,
        description: 'If you have 2: Roll 2 dice in the extra build phase.',
        specialLogic: {
          customLogicId: 'chronoswarm_scaling',
          scalingType: 'by_quantity',
          scalingValues: [
            { quantity: 2, effect: 'roll_2_dice' }
          ]
        }
      },
      {
        powerIndex: 3,
        phase: ShipPowerPhase.END_OF_BUILD,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.CUSTOM,
        description: 'If you have 3: Roll 3 dice in the extra build phase.',
        specialLogic: {
          customLogicId: 'chronoswarm_scaling',
          scalingType: 'by_quantity',
          scalingValues: [
            { quantity: 3, effect: 'roll_3_dice' }
          ]
        }
      }
    ],
    rulesNotes: 'Does not occur the turn it is built. Opponent sees the dice roll(s). If multiple players have Chronoswarms, they all use the same dice rolls. (For 2 and 3) Use only the last rolled dice for Zeniths - not each dice.',
    graphics: [{ component: ChronoswarmShip, condition: 'default' }]
  },

  {
    id: 'HVE',
    name: 'Hive',
    species: Species.XENITE,
    type: ShipType.UPGRADED,
    color: 'Purple',
    upgradedCost: {
      totalLines: 35,
      joiningLines: 4,
      componentShips: [
        { shipId: 'XEN', quantity: 1 },
        { shipId: 'ANT', quantity: 1, mustBeDepleted: true },
        { shipId: 'MAN', quantity: 2 },
        { shipId: 'HEL', quantity: 1 },
        { shipId: 'BUG', quantity: 2, mustBeDepleted: true }
      ]
    },
    powers: [
      {
        powerIndex: 1,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.COUNT_AND_DAMAGE,
        baseAmount: 1,
        description: 'Deal 1 damage for each of your ships.',
        specialLogic: {
          countType: 'self_ships',
          countMultiplier: 1
        }
      },
      {
        powerIndex: 2,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.COUNT_AND_HEAL,
        baseAmount: 1,
        description: 'Heal 1 for each of your ships.',
        specialLogic: {
          countType: 'self_ships',
          countMultiplier: 1
        }
      },
      {
        powerIndex: 3,
        phase: ShipPowerPhase.PASSIVE,
        timing: PowerTiming.PASSIVE,
        effectType: PowerEffectType.CUSTOM,
        description: 'Xenites, Oxites and Asterites within your upgraded ships DO count for your other ship powers.',
        specialLogic: {
          customLogicId: 'hive_passive',
          passiveModifier: 'count_ships_in_upgrades'
        }
      }
    ],
    graphics: [{ component: HiveShip, condition: 'default' }]
  },

  // CENTAUR - Basic Ships (7)
  {
    id: 'FEA',
    name: 'Ship of Fear',
    species: Species.CENTAUR,
    type: ShipType.BASIC,
    color: 'Pastel Green',
    basicCost: { lines: 2 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.ONCE_ONLY_AUTOMATIC,
      effectType: PowerEffectType.HEAL,
      baseAmount: 4,
      description: 'Heal 4, once only on the turn it is built.',
      specialLogic: {
        customLogicId: 'once_only_on_build'
      }
    }],
    graphics: [{ component: ShipOfFearShip, condition: 'default' }]
  },

  {
    id: 'ANG',
    name: 'Ship of Anger',
    species: Species.CENTAUR,
    type: ShipType.BASIC,
    color: 'Pastel Red',
    basicCost: { lines: 3 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.ONCE_ONLY_AUTOMATIC,
      effectType: PowerEffectType.DEAL_DAMAGE,
      baseAmount: 4,
      description: 'Deal 4 damage, once only on the turn it is built.',
      specialLogic: {
        customLogicId: 'once_only_on_build'
      }
    }],
    graphics: [{ component: ShipOfAngerShip, condition: 'default' }]
  },

  {
    id: 'EQU',
    name: 'Ship of Equality',
    species: Species.CENTAUR,
    type: ShipType.BASIC,
    color: 'Pastel Orange',
    basicCost: { lines: 4 },
    maxCharges: 2,
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.SIMULTANEOUS_DECLARATION,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.DESTROY_SHIP,
      baseAmount: 2,
      description: 'Destroy one basic ship of yours, and one basic ship of your opponents with an EQUAL number of total lines (use 1 charge).',
      requiresCharge: true,
      requiresPlayerChoice: true,
      choiceType: 'target_selection',
      specialLogic: {
        customLogicId: 'equality_destroy_equal_cost',
        targetType: 'basic_only',
        mustMatchCost: true
      }
    }],
    rulesNotes: 'Mark as each charge is used. Cannot target other Ships of Equality. If there are not two valid targets, cannot be used. If either target is destroyed, charge is still used.',
    graphics: [
      { component: ShipOfEquality2Ship, condition: 'charges_2' },
      { component: ShipOfEquality1Ship, condition: 'charges_1' },
      { component: ShipOfEquality0Ship, condition: 'charges_depleted' }
    ]
  },

  {
    id: 'WIS',
    name: 'Ship of Wisdom',
    species: Species.CENTAUR,
    type: ShipType.BASIC,
    color: 'Pastel Purple',
    basicCost: { lines: 4 },
    maxCharges: 2,
    powers: [
      {
        powerIndex: 1,
        phase: ShipPowerPhase.SIMULTANEOUS_DECLARATION,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.DEAL_DAMAGE,
        baseAmount: 3,
        description: 'Deal 3 damage (use 1 charge).',
        requiresCharge: true
      },
      {
        powerIndex: 2,
        phase: ShipPowerPhase.SIMULTANEOUS_DECLARATION,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.HEAL,
        baseAmount: 4,
        description: 'Heal 4 (use 1 charge).',
        requiresCharge: true
      }
    ],
    graphics: [
      { component: ShipOfWisdom2Ship, condition: 'charges_2' },
      { component: ShipOfWisdom1Ship, condition: 'charges_1' },
      { component: ShipOfWisdom0Ship, condition: 'charges_depleted' }
    ]
  },

  {
    id: 'VIG',
    name: 'Ship of Vigor',
    species: Species.CENTAUR,
    type: ShipType.BASIC,
    color: 'Pastel Blue',
    basicCost: { lines: 6 },
    maxQuantity: 3,
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.LINE_GENERATION,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.CONDITIONAL,
      baseAmount: 2,
      description: 'Each future build phase, if dice roll is even (2, 4, 6) generate TWO additional lines.',
      specialLogic: {
        customLogicId: 'vigor_even_dice',
        conditionType: 'dice_value',
        condition: 'even'
      }
    }],
    rulesNotes: 'You can have a maximum of 3 Ships of Vigor.',
    graphics: [{ component: ShipOfVigorShip, condition: 'default' }]
  },

  {
    id: 'FAM',
    name: 'Ship of Family',
    species: Species.CENTAUR,
    type: ShipType.BASIC,
    color: 'Pastel Pink',
    basicCost: { lines: 6 },
    maxCharges: 3,
    powers: [
      {
        powerIndex: 1,
        phase: ShipPowerPhase.SIMULTANEOUS_DECLARATION,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.COUNT_AND_DAMAGE,
        baseAmount: 1,
        description: 'Deal 1 damage for each TYPE of ship you have (use 1 charge).',
        requiresCharge: true,
        specialLogic: {
          countType: 'ship_types',
          countMultiplier: 1
        }
      },
      {
        powerIndex: 2,
        phase: ShipPowerPhase.SIMULTANEOUS_DECLARATION,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.COUNT_AND_HEAL,
        baseAmount: 1,
        description: 'Heal 1 for each TYPE of ship you have (use 1 charge).',
        requiresCharge: true,
        specialLogic: {
          countType: 'ship_types',
          countMultiplier: 1
        }
      }
    ],
    rulesNotes: 'TYPE are counted during Charge Declaration.',
    graphics: [
      { component: ShipOfFamily3Ship, condition: 'charges_3' },
      { component: ShipOfFamily2Ship, condition: 'charges_2' },
      { component: ShipOfFamily1Ship, condition: 'charges_1' },
      { component: ShipOfFamily0Ship, condition: 'charges_depleted' }
    ]
  },

  {
    id: 'LEG',
    name: 'Ship of Legacy',
    species: Species.CENTAUR,
    type: ShipType.BASIC,
    color: 'Pastel Yellow',
    basicCost: { lines: 8 },
    powers: [
      {
        powerIndex: 1,
        phase: ShipPowerPhase.DRAWING,
        timing: PowerTiming.ONCE_ONLY_AUTOMATIC,
        effectType: PowerEffectType.GAIN_JOINING_LINES,
        baseAmount: 4,
        description: 'When built, generate 4 joining lines.'
      },
      {
        powerIndex: 2,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.DEAL_DAMAGE,
        baseAmount: 1,
        description: 'Deal 1 damage.'
      },
      {
        powerIndex: 3,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.HEAL,
        baseAmount: 2,
        description: 'Heal 2.'
      }
    ],
    rulesNotes: 'Joining lines can be drawn immediately or saved. These may only be used as joining lines. If they complete an upgraded ship it is active this turn.',
    graphics: [{ component: ShipOfLegacyShip, condition: 'default' }]
  },

  // CENTAUR - Upgraded Ships (9)
  {
    id: 'TER',
    name: 'Ark of Terror',
    species: Species.CENTAUR,
    type: ShipType.UPGRADED,
    color: 'Green',
    upgradedCost: {
      totalLines: 7,
      joiningLines: 3,
      componentShips: [
        { shipId: 'FEA', quantity: 2 }
      ]
    },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.CUSTOM,
      description: 'Heal equal to the dice roll this turn.',
      specialLogic: {
        customLogicId: 'terror_heal_dice',
        healAmount: 'dice_roll'
      }
    }],
    graphics: [{ component: ArkOfTerrorShip, condition: 'default' }]
  },

  {
    id: 'FUR',
    name: 'Ark of Fury',
    species: Species.CENTAUR,
    type: ShipType.UPGRADED,
    color: 'Orange',
    upgradedCost: {
      totalLines: 10,
      joiningLines: 4,
      componentShips: [
        { shipId: 'ANG', quantity: 2 }
      ]
    },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.CUSTOM,
      description: 'Deal damage equal to the dice roll this turn.',
      specialLogic: {
        customLogicId: 'fury_damage_dice',
        damageAmount: 'dice_roll'
      }
    }],
    graphics: [{ component: ArkOfFuryShip, condition: 'default' }]
  },

  {
    id: 'KNO',
    name: 'Ark of Knowledge',
    species: Species.CENTAUR,
    type: ShipType.UPGRADED,
    color: 'Pink',
    upgradedCost: {
      totalLines: 12,
      joiningLines: 2,
      componentShips: [
        { shipId: 'WIS', quantity: 1, mustBeDepleted: true },
        { shipId: 'FAM', quantity: 1, mustBeDepleted: true }
      ]
    },
    powers: [
      {
        powerIndex: 1,
        phase: ShipPowerPhase.DICE_MANIPULATION,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.REROLL_DICE,
        description: 'If you have 1 Ark of Knowledge: You may reroll the dice during build phase (for all players, the original roll is not used). If you have 2 Arks of Knowledge: You may reroll the dice TWICE during build phase (for all players, the original roll is not used).',
        specialLogic: {
          customLogicId: 'ark_knowledge_scaling',
          diceManipulation: 'reroll',
          scalingType: 'by_quantity',
          scalingValues: [
            { quantity: 1, effect: 'reroll' },
            { quantity: 2, effect: 'reroll_twice' }
          ]
        }
      },
      {
        powerIndex: 2,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.HEAL,
        baseAmount: 2,
        description: 'Heal 2.'
      },
      {
        powerIndex: 3,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.CUSTOM,
        description: 'If you have 3 Arks of Knowledge: Also your damage and healing are equal to whichever is higher this turn. Includes \'once only\' and charges.',
        specialLogic: {
          customLogicId: 'ark_knowledge_scaling',
          scalingType: 'by_quantity',
          scalingValues: [
            { quantity: 3, effect: 'equalize_damage_healing' }
          ]
        }
      }
    ],
    graphics: [{ component: ArkOfKnowledgeShip, condition: 'default' }]
  },

  {
    id: 'ENT',
    name: 'Ark of Entropy',
    species: Species.CENTAUR,
    type: ShipType.UPGRADED,
    color: 'Blue',
    upgradedCost: {
      totalLines: 12,
      joiningLines: 4,
      componentShips: [
        { shipId: 'EQU', quantity: 2, mustBeDepleted: true }
      ]
    },
    powers: [
      {
        powerIndex: 1,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.DEAL_DAMAGE,
        baseAmount: 7,
        description: 'Deal 7 damage.'
      },
      {
        powerIndex: 2,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.CUSTOM,
        baseAmount: 4,
        description: 'Take 4 damage.',
        specialLogic: {
          customLogicId: 'entropy_self_damage',
          damageTarget: 'self'
        }
      }
    ],
    graphics: [{ component: ArkOfEntropyShip, condition: 'default' }]
  },

  {
    id: 'RED',
    name: 'Ark of Redemption',
    species: Species.CENTAUR,
    type: ShipType.UPGRADED,
    color: 'Yellow',
    upgradedCost: {
      totalLines: 15,
      joiningLines: 3,
      componentShips: [
        { shipId: 'WIS', quantity: 3, mustBeDepleted: true }
      ]
    },
    powers: [
      {
        powerIndex: 1,
        phase: ShipPowerPhase.LINE_GENERATION,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.GAIN_JOINING_LINES,
        baseAmount: 2,
        description: 'Generate 2 joining lines each future build phase.'
      },
      {
        powerIndex: 2,
        phase: ShipPowerPhase.END_OF_BUILD,
        timing: PowerTiming.ONCE_ONLY_AUTOMATIC,
        effectType: PowerEffectType.SET_HEALTH_MAX,
        description: 'When built set your health to maximum. This is not \'healing\', and occurs before the Battle Phase. Does not affect Ark of Knowledge.',
        specialLogic: {
          customLogicId: 'redemption_set_health_max'
        }
      }
    ],
    graphics: [{ component: ArkOfRedemptionShip, condition: 'default' }]
  },

  {
    id: 'POW',
    name: 'Ark of Power',
    species: Species.CENTAUR,
    type: ShipType.UPGRADED,
    color: 'Cyan',
    upgradedCost: {
      totalLines: 20,
      joiningLines: 6,
      componentShips: [
        { shipId: 'FEA', quantity: 1 },
        { shipId: 'ANG', quantity: 2 },
        { shipId: 'VIG', quantity: 1 }
      ]
    },
    maxQuantity: 2,
    powers: [
      {
        powerIndex: 1,
        phase: ShipPowerPhase.LINE_GENERATION,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.CONDITIONAL,
        baseAmount: 4,
        description: 'Each future build phase, if dice roll is even (2, 4, 6) generate FOUR additional lines.',
        specialLogic: {
          customLogicId: 'power_even_dice',
          conditionType: 'dice_value',
          condition: 'even'
        }
      },
      {
        powerIndex: 2,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.DEAL_DAMAGE,
        baseAmount: 2,
        description: 'Deal 2 damage.'
      },
      {
        powerIndex: 3,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.HEAL,
        baseAmount: 3,
        description: 'Heal 3.'
      }
    ],
    rulesNotes: 'You can have a maximum of 2 Arks of Power.',
    graphics: [{ component: ArkOfPowerShip, condition: 'default' }]
  },

  {
    id: 'DES',
    name: 'Ark of Destruction',
    species: Species.CENTAUR,
    type: ShipType.UPGRADED,
    color: 'Red',
    upgradedCost: {
      totalLines: 31,
      joiningLines: 12,
      componentShips: [
        { shipId: 'FEA', quantity: 2 },
        { shipId: 'ANG', quantity: 1 },
        { shipId: 'EQU', quantity: 1, mustBeDepleted: true },
        { shipId: 'LEG', quantity: 1 }
      ]
    },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.AUTOMATIC,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.COUNT_AND_DAMAGE,
      baseAmount: 3,
      description: 'Deal 3 damage for each of your other ships. Does NOT include itself.',
      specialLogic: {
        countType: 'self_ships',
        countMultiplier: 1,
        excludeSelf: true
      }
    }],
    graphics: [{ component: ArkOfDestructionShip, condition: 'default' }]
  },

  {
    id: 'DOM',
    name: 'Ark of Domination',
    species: Species.CENTAUR,
    type: ShipType.UPGRADED,
    color: 'Purple',
    upgradedCost: {
      totalLines: 40,
      joiningLines: 12,
      componentShips: [
        { shipId: 'FEA', quantity: 1 },
        { shipId: 'VIG', quantity: 1 },
        { shipId: 'FAM', quantity: 2, mustBeDepleted: true },
        { shipId: 'LEG', quantity: 1 }
      ]
    },
    powers: [
      {
        powerIndex: 1,
        phase: ShipPowerPhase.LINE_GENERATION,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.GAIN_JOINING_LINES,
        baseAmount: 2,
        description: 'Generate 2 joining lines each future build phase.'
      },
      {
        powerIndex: 2,
        phase: ShipPowerPhase.FIRST_STRIKE,
        timing: PowerTiming.ONCE_ONLY_AUTOMATIC,
        effectType: PowerEffectType.STEAL_SHIP,
        baseAmount: 2,
        description: 'Once, on the turn it is built, at the start of the battle phase, take permanent control of TWO basic (non-upgraded) enemy ships.',
        requiresPlayerChoice: true,
        choiceType: 'target_selection',
        specialLogic: {
          customLogicId: 'domination_steal_ships',
          targetType: 'basic_only'
        }
      },
      {
        powerIndex: 3,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.COUNT_AND_HEAL,
        baseAmount: 3,
        description: 'Heal 3 for each of your ships.',
        specialLogic: {
          countType: 'self_ships',
          countMultiplier: 1
        }
      }
    ],
    rulesNotes: 'Enemy ships will be removed from their fleet and added to your fleet. Their Charge powers and Automatic powers will be active for you.',
    graphics: [{ component: ArkOfDominationShip, condition: 'default' }]
  },

  // ANCIENT - Basic Ships (7)
  {
    id: 'MER',
    name: 'Mercury Core',
    species: Species.ANCIENT,
    type: ShipType.BASIC,
    color: 'Pastel Red',
    basicCost: { lines: 4 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.SIMULTANEOUS_DECLARATION,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.GAIN_ENERGY,
      baseAmount: 1,
      description: 'Gain 1 red energy each battle phase.',
      specialLogic: {
        energyColor: 'red'
      }
    }],
    graphics: [{ component: MercuryCore, condition: 'default' }]
  },

  {
    id: 'PLU',
    name: 'Pluto Core',
    species: Species.ANCIENT,
    type: ShipType.BASIC,
    color: 'Pastel Green',
    basicCost: { lines: 4 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.SIMULTANEOUS_DECLARATION,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.GAIN_ENERGY,
      baseAmount: 1,
      description: 'Gain 1 green energy each battle phase.',
      specialLogic: {
        energyColor: 'green'
      }
    }],
    graphics: [{ component: PlutoCore, condition: 'default' }]
  },

  {
    id: 'QUA',
    name: 'Quantum Mystic',
    species: Species.ANCIENT,
    type: ShipType.BASIC,
    color: 'Pastel Purple',
    basicCost: { lines: 5 },
    maxQuantity: 6,
    powers: [
      {
        powerIndex: 1,
        phase: ShipPowerPhase.SIMULTANEOUS_DECLARATION,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.CONDITIONAL,
        baseAmount: 1,
        description: 'If dice roll is 1 or 2 Gain 1 blue energy.',
        specialLogic: {
          customLogicId: 'quantum_conditional_energy',
          conditionType: 'dice_value',
          condition: 'in_range',
          diceRange: [1, 2],
          energyColor: 'blue'
        }
      },
      {
        powerIndex: 2,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.CONDITIONAL,
        baseAmount: 5,
        description: 'If dice roll is 1 or 2 heal 5.',
        specialLogic: {
          customLogicId: 'quantum_conditional_heal',
          conditionType: 'dice_value',
          condition: 'in_range',
          diceRange: [1, 2]
        }
      }
    ],
    rulesNotes: 'You can have a maximum of 6 Quantum Mystics.',
    graphics: [{ component: QuantumMystic, condition: 'default' }]
  },

  {
    id: 'SPI',
    name: 'Spiral',
    species: Species.ANCIENT,
    type: ShipType.BASIC,
    color: 'Pastel Pink',
    basicCost: { lines: 6 },
    powers: [
      {
        powerIndex: 1,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.CUSTOM,
        description: 'If you have one: Heal 1 for each red and/or green energy you spent this turn.',
        specialLogic: {
          customLogicId: 'spiral_scaling',
          scalingType: 'by_quantity',
          scalingValues: [
            { quantity: 1, effect: 'heal_per_energy_spent', energyColors: ['red', 'green'] }
          ]
        }
      },
      {
        powerIndex: 2,
        phase: ShipPowerPhase.PASSIVE,
        timing: PowerTiming.PASSIVE,
        effectType: PowerEffectType.INCREASE_MAX_HEALTH,
        baseAmount: 15,
        description: 'If you have two: Also, increase your maximum health by 15.',
        specialLogic: {
          customLogicId: 'spiral_scaling',
          scalingType: 'by_quantity',
          scalingValues: [
            { quantity: 2, effect: 'increase_max_health', amount: 15 }
          ]
        }
      },
      {
        powerIndex: 3,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.CUSTOM,
        description: 'If you have three: Also, Deal 1 damage for each red and/or green energy you spent this turn.',
        specialLogic: {
          customLogicId: 'spiral_scaling',
          scalingType: 'by_quantity',
          scalingValues: [
            { quantity: 3, effect: 'damage_per_energy_spent', energyColors: ['red', 'green'] }
          ]
        }
      }
    ],
    graphics: [{ component: Spiral, condition: 'default' }]
  },

  {
    id: 'URA',
    name: 'Uranus Core',
    species: Species.ANCIENT,
    type: ShipType.BASIC,
    color: 'Pastel Blue',
    basicCost: { lines: 7 },
    maxQuantity: 6,
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.SIMULTANEOUS_DECLARATION,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.GAIN_ENERGY,
      baseAmount: 1,
      description: 'Gain 1 blue energy each battle phase.',
      specialLogic: {
        energyColor: 'blue'
      }
    }],
    rulesNotes: 'You can have a maximum of 6 Uranus Cores.',
    graphics: [{ component: UranusCore, condition: 'default' }]
  },

  {
    id: 'SOL',
    name: 'Solar Grid',
    species: Species.ANCIENT,
    type: ShipType.BASIC,
    color: 'Pastel Yellow',
    basicCost: { lines: 8 },
    maxCharges: 4,
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.SIMULTANEOUS_DECLARATION,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.GAIN_ENERGY,
      baseAmount: 1,
      description: 'Gain 1 energy of each colour this battle phase (use 1 charge).',
      requiresCharge: true,
      specialLogic: {
        energyColor: 'all'
      }
    }],
    graphics: [
      { component: SolarReserve4, condition: 'charges_4' },
      { component: SolarReserve3, condition: 'charges_3' },
      { component: SolarReserve2, condition: 'charges_2' },
      { component: SolarReserve1, condition: 'charges_1' },
      { component: SolarReserve0, condition: 'charges_depleted' }
    ]
  },

  {
    id: 'CUB',
    name: 'Cube',
    species: Species.ANCIENT,
    type: ShipType.BASIC,
    color: 'Pastel Orange',
    basicCost: { lines: 9 },
    powers: [{
      powerIndex: 1,
      phase: ShipPowerPhase.SIMULTANEOUS_DECLARATION,
      timing: PowerTiming.CONTINUOUS,
      effectType: PowerEffectType.CUSTOM,
      description: 'Once per turn, you may repeat a solar power that you cast (for free).',
      requiresPlayerChoice: true,
      choiceType: 'solar_power_selection',
      specialLogic: {
        customLogicId: 'cube_repeat_solar',
        maxUsesPerTurn: 1
      }
    }],
    graphics: [{ component: Cube, condition: 'default' }]
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get ship definition by ID
 * @example getShipById('DEF') // Returns Defender definition
 */
export function getShipById(id: string): ShipDefinition | undefined {
  return SHIP_DEFINITIONS.find(ship => ship.id === id);
}

/**
 * Get all ships of a specific species
 * @example getShipsBySpecies(Species.HUMAN) // Returns all Human ships
 */
export function getShipsBySpecies(species: Species): ShipDefinition[] {
  return SHIP_DEFINITIONS.filter(ship => ship.species === species);
}

/**
 * Get all basic ships, optionally filtered by species
 * @example getBasicShips(Species.XENITE) // Returns Xenite basic ships
 */
export function getBasicShips(species?: Species): ShipDefinition[] {
  const basicShips = SHIP_DEFINITIONS.filter(ship => ship.type === ShipType.BASIC);
  return species ? basicShips.filter(ship => ship.species === species) : basicShips;
}

/**
 * Get all upgraded ships, optionally filtered by species
 * @example getUpgradedShips(Species.CENTAUR) // Returns Centaur upgraded ships
 */
export function getUpgradedShips(species?: Species): ShipDefinition[] {
  const upgradedShips = SHIP_DEFINITIONS.filter(ship => ship.type === ShipType.UPGRADED);
  return species ? upgradedShips.filter(ship => ship.species === species) : upgradedShips;
}

/**
 * Get ships by type
 */
export function getShipsByType(type: ShipType): ShipDefinition[] {
  return SHIP_DEFINITIONS.filter(ship => ship.type === type);
}

/**
 * Check if a ship can be built with given line count
 */
export function canBuildShip(shipId: string, availableLines: number): boolean {
  const ship = getShipById(shipId);
  if (!ship) return false;
  
  if (ship.type === ShipType.BASIC && ship.basicCost) {
    return availableLines >= ship.basicCost.lines;
  }
  
  return false;
}

/**
 * Get ships by line cost range
 */
export function getShipsByLineCost(min: number, max: number, species?: Species): ShipDefinition[] {
  let filtered = SHIP_DEFINITIONS.filter(ship => {
    if (ship.type === ShipType.BASIC && ship.basicCost) {
      return ship.basicCost.lines >= min && ship.basicCost.lines <= max;
    }
    if (ship.type === ShipType.UPGRADED && ship.upgradedCost) {
      return ship.upgradedCost.totalLines >= min && ship.upgradedCost.totalLines <= max;
    }
    return false;
  });
  
  return species ? filtered.filter(ship => ship.species === species) : filtered;
}

// ============================================================================
// STATISTICS
// ============================================================================

export const SHIP_STATS = {
  total: 70,
  bySpecies: {
    human: 16,
    xenite: 16,
    centaur: 16,
    ancient: 7
  },
  byType: {
    basic: 30,
    upgraded: 31
  }
};
