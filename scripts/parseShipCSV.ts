// CSV Ship Data Parser
// Parses ship CSV data and generates ShipDefinition objects
// Handles ~70% automated parsing + 30% manual overrides for complex ships

import { 
  ShipDefinition, 
  ShipType, 
  Species, 
  ShipPowerPhase,
  PowerTiming,
  PowerEffectType,
  ShipPower,
  SpecialLogic,
  BasicShipCost,
  UpgradedShipCost,
  ComponentShipRequirement
} from '../game/types/ShipTypes';

// ============================================================================
// CSV ROW INTERFACE
// ============================================================================

interface CSVRow {
  SPECIES: string;
  'SHIP TYPE': string;
  'SHIP NAME': string;
  ID: string;
  'TOTAL LINE COST': string;
  'JOINING LINE COST': string;
  'COMPONENT SHIPS': string;
  'NUMBER OF POWERS': string;
  CHARGES: string;
  'POWER 1 SUBPHASE': string;
  'POWER 1': string;
  'POWER 2 SUBPHASE': string;
  'POWER 2': string;
  'POWER 3 SUBPHASE': string;
  'POWER 3': string;
  'EXTRA RULES': string;
  'STACK CAPTION': string;
  COLOUR: string;
  'NUMBER OF GRAPHICS': string;
}

// ============================================================================
// MANUAL OVERRIDES (Complex ships that need hand-crafted logic)
// ============================================================================

const MANUAL_OVERRIDES: Record<string, Partial<ShipDefinition>> = {
  // ========================================
  // HUMAN - Manual Overrides (5 ships)
  // ========================================
  
  'FRI': {
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
    graphics: [{ filename: 'fri.svg', condition: 'default' }]
  },
  
  'SCI': {
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
    graphics: [{ filename: 'sci.svg', condition: 'default' }]
  },
  
  'DRE': {
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
    graphics: [{ filename: 'dre.svg', condition: 'default' }]
  },
  
  'LEV': {
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
    graphics: [{ filename: 'lev.svg', condition: 'default' }]
  },
  
  'STA': {
    id: 'STA',
    name: 'Starship',
    species: Species.HUMAN,
    type: ShipType.BASIC,
    color: 'Pastel Pink',
    basicCost: { lines: 8 },
    powers: [
      {
        powerIndex: 1,
        phase: ShipPowerPhase.AUTOMATIC,
        timing: PowerTiming.ONCE_ONLY_AUTOMATIC,
        effectType: PowerEffectType.DEAL_DAMAGE,
        baseAmount: 8,
        description: 'Deal 8 damage, once only on the turn it is built.',
        specialLogic: {
          customLogicId: 'once_only_on_build'
        }
      }
    ],
    graphics: [{ filename: 'sta.svg', condition: 'default' }]
  },
  
  // ========================================
  // XENITE - Manual Overrides (8 ships)
  // ========================================
  
  'EVO': {
    id: 'EVO',
    name: 'Evolver',
    species: Species.XENITE,
    type: ShipType.BASIC,
    color: 'Pastel Purple',
    basicCost: { lines: 4 },
    powers: [
      {
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
      }
    ],
    rulesNotes: 'If no Xenites available power cannot be used.',
    graphics: [{ filename: 'evo.svg', condition: 'default' }]
  },
  
  'ZEN': {
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
        phase: ShipPowerPhase.UPON_DESTRUCTION,
        timing: PowerTiming.UPON_DESTRUCTION,
        effectType: PowerEffectType.BUILD_SHIP,
        baseAmount: 2,
        description: 'Upon destruction, make two Xenites.',
        specialLogic: {
          customLogicId: 'zenith_upon_destruction',
          buildShipId: 'XEN',
          persistsIfSourceDestroyed: true
        }
      }
    ],
    graphics: [{ filename: 'zen.svg', condition: 'default' }]
  },
  
  'DSW': {
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
    powers: [
      {
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
      }
    ],
    graphics: [{ filename: 'dsw.svg', condition: 'default' }]
  },
  
  'AAR': {
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
    powers: [
      {
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
      }
    ],
    graphics: [{ filename: 'aar.svg', condition: 'default' }]
  },
  
  'SAC': {
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
    graphics: [{ filename: 'sac.svg', condition: 'default' }]
  },
  
  'QUE': {
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
    graphics: [{ filename: 'que.svg', condition: 'default' }]
  },
  
  'CHR': {
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
    graphics: [{ filename: 'chr.svg', condition: 'default' }]
  },
  
  'HVE': {
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
    graphics: [{ filename: 'hve.svg', condition: 'default' }]
  },
  
  // ========================================
  // CENTAUR - Manual Overrides (5 ships)
  // ========================================
  
  'VIG': {
    id: 'VIG',
    name: 'Ship of Vigor',
    species: Species.CENTAUR,
    type: ShipType.BASIC,
    color: 'Pastel Blue',
    basicCost: { lines: 6 },
    maxQuantity: 3,
    powers: [
      {
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
      }
    ],
    rulesNotes: 'You can have a maximum of 3 Ships of Vigor.',
    graphics: [{ filename: 'vig.svg', condition: 'default' }]
  },
  
  'KNO': {
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
    graphics: [{ filename: 'kno.svg', condition: 'default' }]
  },
  
  'RED': {
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
    graphics: [{ filename: 'red.svg', condition: 'default' }]
  },
  
  'POW': {
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
    graphics: [{ filename: 'pow.svg', condition: 'default' }]
  },
  
  'DOM': {
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
          countMultiplier: 3
        }
      }
    ],
    rulesNotes: 'Enemy ships will be removed from their fleet and added to your fleet. Their Charge powers and Automatic powers will be active for you.',
    graphics: [{ filename: 'dom.svg', condition: 'default' }]
  },
  
  // ========================================
  // ANCIENT - Manual Overrides (5 ships)
  // ========================================
  
  'QUA': {
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
    graphics: [{ filename: 'qua.svg', condition: 'default' }]
  },
  
  'SPI': {
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
    graphics: [{ filename: 'spi.svg', condition: 'default' }]
  },
  
  'CUB': {
    id: 'CUB',
    name: 'Cube',
    species: Species.ANCIENT,
    type: ShipType.BASIC,
    color: 'Pastel Orange',
    basicCost: { lines: 9 },
    powers: [
      {
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
      }
    ],
    graphics: [{ filename: 'cub.svg', condition: 'default' }]
  },
  
  'SSIM': {
    id: 'SSIM',
    name: 'Simulacrum',
    species: Species.ANCIENT,
    type: ShipType.SOLAR_POWER,
    color: 'N/A',
    energyCost: { blue: 'X' }, // Variable cost
    powers: [
      {
        powerIndex: 1,
        phase: ShipPowerPhase.SIMULTANEOUS_DECLARATION,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.COPY_SHIP,
        baseAmount: 1,
        description: 'Make a copy of a basic enemy ship. X = Number of lines in ship.',
        requiresPlayerChoice: true,
        choiceType: 'target_selection',
        specialLogic: {
          customLogicId: 'simulacrum_copy',
          variableCostFormula: 'target_ship_lines',
          targetType: 'basic_only'
        }
      }
    ],
    rulesNotes: 'Each ship may only be copied ONCE per turn. Ships with charges are copied as they are at the START of this turn. Copied ships CAN be upgraded. A Cube-cast makes an extra copy of target ship. Cannot copy Cube.',
    graphics: []
  },
  
  'SBLA': {
    id: 'SBLA',
    name: 'Black Hole',
    species: Species.ANCIENT,
    type: ShipType.SOLAR_POWER,
    color: 'N/A',
    energyCost: { red: 3, green: 3, blue: 3 },
    powers: [
      {
        powerIndex: 1,
        phase: ShipPowerPhase.SIMULTANEOUS_DECLARATION,
        timing: PowerTiming.CONTINUOUS,
        effectType: PowerEffectType.DESTROY_SHIP,
        baseAmount: 2,
        description: 'Destroy TWO of the opponent\'s basic ships. Deal 4 damage.',
        requiresPlayerChoice: true,
        choiceType: 'target_selection',
        specialLogic: {
          customLogicId: 'black_hole_destroy_and_damage',
          destroyQuantity: 2,
          targetType: 'basic_only',
          additionalDamage: 4
        }
      }
    ],
    graphics: []
  }
};

// ============================================================================
// PARSING UTILITIES
// ============================================================================

function parseSpecies(species: string): Species {
  const normalized = species.toLowerCase().trim();
  switch (normalized) {
    case 'human': return Species.HUMAN;
    case 'xenite': return Species.XENITE;
    case 'centaur': return Species.CENTAUR;
    case 'ancient': return Species.ANCIENT;
    default:
      throw new Error(`Unknown species: ${species}`);
  }
}

function parseShipType(shipType: string): ShipType {
  const normalized = shipType.toLowerCase().trim();
  if (normalized.includes('basic')) {
    return ShipType.BASIC;
  } else if (normalized.includes('upgraded')) {
    return ShipType.UPGRADED;
  } else if (normalized.includes('solar')) {
    return ShipType.SOLAR_POWER;
  }
  // Default to BASIC for empty/malformed
  console.warn(`Unknown ship type: ${shipType}, defaulting to BASIC`);
  return ShipType.BASIC;
}

function parsePhase(subphase: string): { phase: ShipPowerPhase; timing: PowerTiming } {
  const normalized = subphase.toLowerCase().trim();
  
  // Line Generation
  if (normalized.includes('line generation')) {
    return { phase: ShipPowerPhase.LINE_GENERATION, timing: PowerTiming.CONTINUOUS };
  }
  
  // Ships That Build
  if (normalized.includes('ships that build')) {
    return { phase: ShipPowerPhase.SHIPS_THAT_BUILD, timing: PowerTiming.CONTINUOUS };
  }
  
  // Drawing / End of Build
  if (normalized.includes('drawing') || normalized.includes('end of build')) {
    // Check if it's a "once only" effect
    if (normalized.includes('once only') || normalized.includes('when built')) {
      return { phase: ShipPowerPhase.END_OF_BUILD, timing: PowerTiming.ONCE_ONLY_AUTOMATIC };
    }
    return { phase: ShipPowerPhase.DRAWING, timing: PowerTiming.CONTINUOUS };
  }
  
  // First Strike
  if (normalized.includes('first strike')) {
    return { phase: ShipPowerPhase.FIRST_STRIKE, timing: PowerTiming.CONTINUOUS };
  }
  
  // Charge Declaration (Battle Phase)
  if (normalized.includes('charge declaration') || normalized.includes('simultaneous')) {
    return { phase: ShipPowerPhase.SIMULTANEOUS_DECLARATION, timing: PowerTiming.CONTINUOUS };
  }
  
  // Automatic (End of Turn)
  if (normalized.includes('automatic') || normalized.includes('end of turn')) {
    return { phase: ShipPowerPhase.AUTOMATIC, timing: PowerTiming.CONTINUOUS };
  }
  
  // Dice Manipulation
  if (normalized.includes('dice')) {
    return { phase: ShipPowerPhase.DICE_MANIPULATION, timing: PowerTiming.CONTINUOUS };
  }
  
  // Upon Destruction
  if (normalized.includes('destruction')) {
    return { phase: ShipPowerPhase.UPON_DESTRUCTION, timing: PowerTiming.UPON_DESTRUCTION };
  }
  
  // Passive
  if (normalized.includes('passive')) {
    return { phase: ShipPowerPhase.PASSIVE, timing: PowerTiming.PASSIVE };
  }
  
  // Default to automatic
  console.warn(`Unknown phase: ${subphase}, defaulting to AUTOMATIC`);
  return { phase: ShipPowerPhase.AUTOMATIC, timing: PowerTiming.CONTINUOUS };
}

function parsePowerDescription(description: string): { 
  effectType: PowerEffectType; 
  baseAmount?: number; 
  specialLogic?: SpecialLogic;
  requiresCharge?: boolean;
  requiresPlayerChoice?: boolean;
  choiceType?: string;
} {
  const normalized = description.toLowerCase().trim();
  
  // Empty power
  if (!description || description.trim() === '-' || description.trim() === '') {
    return { effectType: PowerEffectType.CUSTOM };
  }
  
  // Charge-based powers (use charge to activate)
  const requiresCharge = normalized.includes('use a charge') || normalized.includes('use charge');
  
  // Player choice required
  let requiresPlayerChoice = false;
  let choiceType: string | undefined;
  
  if (normalized.includes('choose') || normalized.includes('select')) {
    requiresPlayerChoice = true;
    choiceType = 'target_selection';
  }
  
  if (normalized.includes(' or ')) {
    requiresPlayerChoice = true;
    choiceType = 'or_choice';
  }
  
  // Heal X
  const healMatch = normalized.match(/heal (\d+)/);
  if (healMatch) {
    return { 
      effectType: PowerEffectType.HEAL, 
      baseAmount: parseInt(healMatch[1]),
      requiresCharge,
      requiresPlayerChoice,
      choiceType
    };
  }
  
  // Deal X damage
  const damageMatch = normalized.match(/deal (\d+) damage/);
  if (damageMatch) {
    return { 
      effectType: PowerEffectType.DEAL_DAMAGE, 
      baseAmount: parseInt(damageMatch[1]),
      requiresCharge,
      requiresPlayerChoice,
      choiceType
    };
  }
  
  // Generate X lines / joining lines
  const linesMatch = normalized.match(/(\d+) (?:bonus )?(?:extra )?lines?/);
  if (linesMatch) {
    if (normalized.includes('joining')) {
      return { 
        effectType: PowerEffectType.GAIN_JOINING_LINES, 
        baseAmount: parseInt(linesMatch[1]),
        requiresCharge
      };
    }
    return { 
      effectType: PowerEffectType.GAIN_LINES, 
      baseAmount: parseInt(linesMatch[1]),
      requiresCharge
    };
  }
  
  // Make a ship
  if (normalized.includes('make a ') || normalized.includes('make two ') || normalized.includes('make three ')) {
    const shipMatch = normalized.match(/make (one|two|three|a|an|\d+) (\w+)/);
    const quantityMap: Record<string, number> = { 'one': 1, 'a': 1, 'an': 1, 'two': 2, 'three': 3 };
    const quantity = shipMatch ? (quantityMap[shipMatch[1]] || parseInt(shipMatch[1])) : 1;
    
    return { 
      effectType: PowerEffectType.BUILD_SHIP, 
      baseAmount: quantity,
      specialLogic: { customLogicId: `build_ship_${normalized.replace(/\s+/g, '_')}` },
      requiresCharge,
      requiresPlayerChoice,
      choiceType: 'ship_selection'
    };
  }
  
  // Gain energy (Ancient)
  if (normalized.includes('gain') && (normalized.includes('red') || normalized.includes('green') || normalized.includes('blue'))) {
    return { 
      effectType: PowerEffectType.GAIN_ENERGY,
      specialLogic: { customLogicId: `gain_energy_${normalized.replace(/\s+/g, '_')}` }
    };
  }
  
  // Destroy ship
  if (normalized.includes('destroy')) {
    return { 
      effectType: PowerEffectType.DESTROY_SHIP,
      requiresCharge,
      requiresPlayerChoice: true,
      choiceType: 'target_selection'
    };
  }
  
  // Steal/control ship
  if (normalized.includes('take control') || normalized.includes('steal')) {
    return { 
      effectType: PowerEffectType.STEAL_SHIP,
      requiresCharge,
      requiresPlayerChoice: true,
      choiceType: 'target_selection'
    };
  }
  
  // Copy ship
  if (normalized.includes('copy')) {
    return { 
      effectType: PowerEffectType.COPY_SHIP,
      requiresCharge,
      requiresPlayerChoice: true,
      choiceType: 'target_selection'
    };
  }
  
  // Set health to maximum
  if (normalized.includes('set') && normalized.includes('health') && normalized.includes('maximum')) {
    return { 
      effectType: PowerEffectType.SET_HEALTH_MAX,
      requiresCharge
    };
  }
  
  // Increase maximum health
  if (normalized.includes('increase') && normalized.includes('maximum health')) {
    const amountMatch = normalized.match(/by (\d+)/);
    return { 
      effectType: PowerEffectType.INCREASE_MAX_HEALTH,
      baseAmount: amountMatch ? parseInt(amountMatch[1]) : 15
    };
  }
  
  // Reroll dice
  if (normalized.includes('reroll')) {
    return { 
      effectType: PowerEffectType.REROLL_DICE,
      specialLogic: { 
        diceManipulation: normalized.includes('twice') ? 'reroll_twice' : 'reroll'
      },
      requiresCharge
    };
  }
  
  // Force dice value
  if (normalized.includes('dice') && (normalized.includes('becomes') || normalized.includes('counts as'))) {
    const valueMatch = normalized.match(/(\d+)/);
    return { 
      effectType: PowerEffectType.FORCE_DICE_VALUE,
      baseAmount: valueMatch ? parseInt(valueMatch[1]) : 6,
      specialLogic: { 
        diceManipulation: 'force_value',
        forcedDiceValue: valueMatch ? parseInt(valueMatch[1]) : 6
      }
    };
  }
  
  // Counting logic (deal damage for each X)
  if (normalized.includes(' for each ') || normalized.includes(' for every ')) {
    const countingLogic = parseCountingLogic(normalized);
    if (countingLogic) {
      return {
        effectType: normalized.includes('heal') ? PowerEffectType.COUNT_AND_HEAL : PowerEffectType.COUNT_AND_DAMAGE,
        specialLogic: countingLogic,
        requiresCharge
      };
    }
  }
  
  // Conditional effects
  if (normalized.includes(' if ')) {
    return {
      effectType: PowerEffectType.CONDITIONAL,
      specialLogic: { customLogicId: `conditional_${normalized.replace(/\s+/g, '_').substring(0, 30)}` },
      requiresCharge,
      requiresPlayerChoice,
      choiceType
    };
  }
  
  // Complex/unknown - needs manual override
  return { 
    effectType: PowerEffectType.CUSTOM,
    specialLogic: { customLogicId: `custom_${normalized.replace(/\s+/g, '_').substring(0, 30)}` },
    requiresCharge,
    requiresPlayerChoice,
    choiceType
  };
}

function parseCountingLogic(description: string): SpecialLogic | null {
  const normalized = description.toLowerCase();
  
  // "for every THREE of your Fighters"
  const everyXMatch = normalized.match(/every (\w+) (?:of your )?(\w+)/);
  if (everyXMatch) {
    const numberMap: Record<string, number> = { 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5 };
    const multiplier = numberMap[everyXMatch[1]] || 1;
    
    return {
      countType: 'specific_ship_type',
      countTarget: everyXMatch[2].toUpperCase(),
      countMultiplier: multiplier
    };
  }
  
  // "for each TYPE of ship"
  if (normalized.includes('type of ship')) {
    return {
      countType: 'ship_types',
      countMultiplier: 1
    };
  }
  
  // "for each of your ships"
  if (normalized.includes('each of your')) {
    return {
      countType: 'self_ships',
      countMultiplier: 1
    };
  }
  
  // "for each enemy ship"
  if (normalized.includes('each enemy') || normalized.includes('each opponent')) {
    return {
      countType: 'opponent_ships',
      countMultiplier: 1
    };
  }
  
  return null;
}

function parseComponentShips(componentString: string, chargesString: string): ComponentShipRequirement[] {
  if (!componentString || componentString.trim() === '-') {
    return [];
  }
  
  const components: ComponentShipRequirement[] = [];
  
  // Split by commas and process each component
  const parts = componentString.split(',').map(s => s.trim());
  
  for (const part of parts) {
    // Match patterns like "2 BUG", "BUG", "BUG(0)", "2 BUG(0)"
    const match = part.match(/(\d+)?\s*([A-Z]{3,4})(\(0\))?/);
    if (match) {
      const quantity = match[1] ? parseInt(match[1]) : 1;
      const shipId = match[2];
      const mustBeDepleted = !!match[3]; // (0) notation
      
      components.push({
        shipId,
        quantity,
        mustBeDepleted
      });
    }
  }
  
  return components;
}

// ============================================================================
// MAIN PARSER
// ============================================================================

export function parseShipCSV(row: CSVRow): ShipDefinition | null {
  try {
    const shipId = row.ID.trim();
    
    // Check for manual override
    if (MANUAL_OVERRIDES[shipId]) {
      console.log(`[Parser] Using manual override for ${shipId}`);
      return MANUAL_OVERRIDES[shipId] as ShipDefinition;
    }
    
    // Basic ship info
    const shipDef: Partial<ShipDefinition> = {
      id: shipId,
      name: row['SHIP NAME'].trim(),
      species: parseSpecies(row.SPECIES),
      type: parseShipType(row['SHIP TYPE']),
      color: row.COLOUR.trim(),
      powers: [],
      graphics: [{ filename: `${shipId.toLowerCase()}.svg`, condition: 'default' }]
    };
    
    // Parse cost
    if (shipDef.type === ShipType.BASIC) {
      const totalLines = parseInt(row['TOTAL LINE COST']);
      shipDef.basicCost = { lines: totalLines };
    } else if (shipDef.type === ShipType.UPGRADED) {
      const totalLines = parseInt(row['TOTAL LINE COST']);
      const joiningLines = parseInt(row['JOINING LINE COST'] || '0');
      const componentShips = parseComponentShips(row['COMPONENT SHIPS'], row.CHARGES);
      
      shipDef.upgradedCost = {
        totalLines,
        joiningLines,
        componentShips
      };
    }
    
    // Parse charges
    if (row.CHARGES && row.CHARGES.trim() !== '-') {
      const chargesMatch = row.CHARGES.match(/(\d+)/);
      if (chargesMatch) {
        shipDef.maxCharges = parseInt(chargesMatch[1]);
      }
    }
    
    // Parse powers (up to 3 powers)
    const powerColumns: Array<{ subphase: string; description: string }> = [
      { subphase: row['POWER 1 SUBPHASE'], description: row['POWER 1'] },
      { subphase: row['POWER 2 SUBPHASE'], description: row['POWER 2'] },
      { subphase: row['POWER 3 SUBPHASE'], description: row['POWER 3'] }
    ];
    
    for (let i = 0; i < powerColumns.length; i++) {
      const { subphase, description } = powerColumns[i];
      
      // Skip empty powers
      if (!description || description.trim() === '-' || description.trim() === '') {
        continue;
      }
      
      const { phase, timing } = parsePhase(subphase);
      const powerDetails = parsePowerDescription(description);
      
      const power: ShipPower = {
        powerIndex: i + 1,
        phase,
        timing,
        effectType: powerDetails.effectType,
        baseAmount: powerDetails.baseAmount,
        description: description.trim(),
        specialLogic: powerDetails.specialLogic,
        requiresCharge: powerDetails.requiresCharge,
        requiresPlayerChoice: powerDetails.requiresPlayerChoice,
        choiceType: powerDetails.choiceType as any
      };
      
      shipDef.powers!.push(power);
    }
    
    // Parse extra rules
    if (row['EXTRA RULES'] && row['EXTRA RULES'].trim() !== '-') {
      shipDef.rulesNotes = row['EXTRA RULES'].trim();
    }
    
    return shipDef as ShipDefinition;
    
  } catch (error) {
    console.error(`[Parser] Error parsing ship ${row.ID}:`, error);
    return null;
  }
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

export function parseAllShips(csvRows: CSVRow[]): ShipDefinition[] {
  const ships: ShipDefinition[] = [];
  const errors: string[] = [];
  
  for (const row of csvRows) {
    try {
      const ship = parseShipCSV(row);
      if (ship) {
        ships.push(ship);
      }
    } catch (error) {
      errors.push(`${row.ID}: ${error}`);
    }
  }
  
  // Log results
  console.log(`[Parser] Successfully parsed ${ships.length} ships`);
  if (errors.length > 0) {
    console.warn(`[Parser] ${errors.length} errors:`, errors);
  }
  
  return ships;
}

// ============================================================================
// VALIDATION
// ============================================================================

export function validateShipDefinition(ship: ShipDefinition): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Required fields
  if (!ship.id) errors.push('Missing id');
  if (!ship.name) errors.push('Missing name');
  if (!ship.species) errors.push('Missing species');
  if (!ship.type) errors.push('Missing type');
  if (!ship.color) errors.push('Missing color');
  
  // Cost validation
  if (ship.type === ShipType.BASIC && !ship.basicCost) {
    errors.push('Basic ship missing basicCost');
  }
  if (ship.type === ShipType.UPGRADED && !ship.upgradedCost) {
    errors.push('Upgraded ship missing upgradedCost');
  }
  
  // Powers validation
  if (!ship.powers || ship.powers.length === 0) {
    errors.push('Ship has no powers');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}