// Ship Definitions - CORE (Auto-Generated from CSV)
// Generated: 2024-12-24
// Total Ships: 79
//
// ⚠️  AUTO-GENERATED - DO NOT EDIT MANUALLY ⚠️
// 
// This file is generated from /game/data/source/GEN2_SHIP_TABLE_1.2.csv
// To update ship data:
//   1. Edit the CSV file
//   2. Run: npm run gen:ships
//   3. Commit both CSV and generated file
//
// CSV is the SINGLE SOURCE OF TRUTH for ship data.

import type { ShipDefinitionCsv } from '../types/ShipTypes.csv';

// ============================================================================
// PURE SHIP DEFINITIONS (79 ships - NO GRAPHICS)
// ============================================================================
// This is the authoritative source for ship data
// Graphics are added separately in ShipDefinitions.tsx

export const PURE_SHIP_DEFINITIONS: ShipDefinitionCsv[] = [
  {
    id: 'DEF',
    name: 'Defender',
    species: 'Human',
    shipType: 'Basic',
    totalLineCost: 2,
    numberOfPowers: 1,
    powers: [
      {
        subphase: 'Automatic',
        text: 'Heal 1.'
      }
    ],
    stackCaption: 'X healing',
    colour: 'Pastel Green',
    numberOfGraphics: 1
  },
  {
    id: 'FIG',
    name: 'Fighter',
    species: 'Human',
    shipType: 'Basic',
    totalLineCost: 3,
    numberOfPowers: 1,
    powers: [
      {
        subphase: 'Automatic',
        text: 'Deal 1 damage.'
      }
    ],
    stackCaption: 'X damage',
    colour: 'Pastel Red',
    numberOfGraphics: 1
  },
  {
    id: 'COM',
    name: 'Commander',
    species: 'Human',
    shipType: 'Basic',
    totalLineCost: 4,
    numberOfPowers: 1,
    powers: [
      {
        subphase: 'Automatic',
        text: 'Deal 1 damage for every THREE of your Fighters.'
      }
    ],
    stackCaption: 'X damage',
    colour: 'Pastel Orange',
    numberOfGraphics: 1
  },
  {
    id: 'INT',
    name: 'Interceptor',
    species: 'Human',
    shipType: 'Basic',
    totalLineCost: 4,
    numberOfPowers: 2,
    charges: 1,
    powers: [
      {
        subphase: 'Charge Declaration',
        text: 'Heal 5  (use 1 charge).'
      },
      {
        subphase: 'Charge Declaration',
        text: 'Deal 5 damage (use 1 charge)'
      }
    ],
    extraRules: 'Can hold charge.',
    stackCaption: '1/1 charges - X damage or X healing (on turn it\'s used) - no caption when depleted',
    colour: 'Pastel Purple',
    numberOfGraphics: 2
  },
  {
    id: 'ORB',
    name: 'Orbital',
    species: 'Human',
    shipType: 'Basic',
    totalLineCost: 6,
    numberOfPowers: 1,
    powers: [
      {
        subphase: 'Line Generation',
        text: 'Generate an additional line in each future build phase.'
      }
    ],
    extraRules: 'You can have a maximum of 6 Orbitals.\n Lines may be saved.',
    stackCaption: '+X lines',
    colour: 'Pastel Blue',
    numberOfGraphics: 1
  },
  {
    id: 'CAR',
    name: 'Carrier',
    species: 'Human',
    shipType: 'Basic',
    totalLineCost: 6,
    numberOfPowers: 2,
    charges: 6,
    powers: [
      {
        subphase: 'Ships That Build',
        text: 'Make a Defender  (use 1 charge).'
      },
      {
        subphase: 'Ships That Build',
        text: 'Make a Fighter (use 2 charges)'
      }
    ],
    extraRules: 'Can only use one power once per subphase. System: notated with CAR(X) where X is remaining charges',
    stackCaption: 'X/6 charges - no caption when depleted',
    colour: 'Pastel Yellow',
    numberOfGraphics: 7
  },
  {
    id: 'STA',
    name: 'Starship',
    species: 'Human',
    shipType: 'Basic',
    totalLineCost: 8,
    numberOfPowers: 1,
    powers: [
      {
        subphase: 'Automatic',
        text: 'Deal 8 damage, once only on the turn it is built.'
      }
    ],
    stackCaption: 'X damage (only on turn it\'s built, then no caption)',
    colour: 'Pastel Pink',
    numberOfGraphics: 1
  },
  {
    id: 'FRI',
    name: 'Frigate',
    species: 'Human',
    shipType: 'Upgraded',
    totalLineCost: 8,
    joiningLineCost: 3,
    componentShips: ['DEF', 'FIG'],
    numberOfPowers: 3,
    powers: [
      {
        subphase: 'Drawing',
        text: 'Choose a trigger number for this ship, 1-6.'
      },
      {
        subphase: 'Automatic',
        text: 'If dice roll matches the trigger number, deal 6 damage. Including the turn this is built.'
      },
      {
        subphase: 'Automatic',
        text: 'Heal 2'
      }
    ],
    stackCaption: 'X healing - HITS X damage',
    colour: 'Yellow',
    numberOfGraphics: 1
  },
  {
    id: 'TAC',
    name: 'Tactical Cruiser',
    species: 'Human',
    shipType: 'Upgraded',
    totalLineCost: 10,
    joiningLineCost: 3,
    componentShips: ['DEF', 'DEF', 'FIG'],
    numberOfPowers: 1,
    powers: [
      {
        subphase: 'Automatic',
        text: 'Deal 1 damage for each TYPE of ship you have.'
      }
    ],
    extraRules: 'Includes Tactical Cruiser as a type. TYPE are counted during End of Turn Resolution.',
    stackCaption: 'X damage - ',
    colour: 'Orange',
    numberOfGraphics: 1
  },
  {
    id: 'GUA',
    name: 'Guardian',
    species: 'Human',
    shipType: 'Upgraded',
    totalLineCost: 12,
    joiningLineCost: 4,
    componentShips: ['DEF', 'DEF', 'COM'],
    numberOfPowers: 1,
    charges: 2,
    powers: [
      {
        subphase: 'First Strike',
        text: 'Destroy a basic enemy ship (use 1 charge).'
      }
    ],
    stackCaption: 'X/2 charges - no caption when depleted',
    colour: 'Blue',
    numberOfGraphics: 3
  },
  {
    id: 'SCI',
    name: 'Science Vessel',
    species: 'Human',
    shipType: 'Upgraded',
    totalLineCost: 17,
    joiningLineCost: 4,
    componentShips: ['DEF', 'FIG', 'STA'],
    numberOfPowers: 3,
    powers: [
      {
        subphase: 'Automatic',
        text: 'If you have 1 Science Vessel: Double your Automatic healing.'
      },
      {
        subphase: 'Automatic',
        text: 'If you have 2 Science Vessels: Double your Automatic damage.'
      },
      {
        subphase: 'Line Generation',
        text: 'If you have 3 Science Vessels: Generate additional lines equal to the dice roll.'
      }
    ],
    stackCaption: 'X healing, X damage, +X lines',
    colour: 'Pink',
    numberOfGraphics: 1
  },
  {
    id: 'BAT',
    name: 'Battle Cruiser',
    species: 'Human',
    shipType: 'Upgraded',
    totalLineCost: 20,
    joiningLineCost: 6,
    componentShips: ['DEF', 'FIG', 'FIG', 'ORB'],
    numberOfPowers: 3,
    powers: [
      {
        subphase: 'Line Generation',
        text: 'Generate 2 additional lines in each future build phase.'
      },
      {
        subphase: 'Automatic',
        text: 'Heal 3.'
      },
      {
        subphase: 'Automatic',
        text: 'Deal 2 damage.'
      }
    ],
    stackCaption: 'X healing, X damage, +X lines',
    colour: 'Cyan',
    numberOfGraphics: 1
  },
  {
    id: 'EAR',
    name: 'Earth Ship',
    species: 'Human',
    shipType: 'Upgraded',
    totalLineCost: 23,
    joiningLineCost: 7,
    componentShips: ['DEF', 'DEF', 'ORB', 'CAR(0)'],
    numberOfPowers: 1,
    powers: [
      {
        subphase: 'Automatic',
        text: 'Deal 3 damage for each of your Carriers.'
      }
    ],
    stackCaption: 'X damage',
    colour: 'Green',
    numberOfGraphics: 1
  },
  {
    id: 'DRE',
    name: 'Dreadnought',
    species: 'Human',
    shipType: 'Upgraded',
    totalLineCost: 27,
    joiningLineCost: 10,
    componentShips: ['DEF', 'DEF', 'FIG', 'FIG', 'FIG', 'COM'],
    numberOfPowers: 2,
    powers: [
      {
        subphase: 'Drawing',
        text: 'When you complete a ship, you may make a FREE additional Fighter.'
      },
      {
        subphase: 'Automatic',
        text: 'Deal 10 damage.'
      }
    ],
    extraRules: 'The Dreadnought\'s build power activates whenever you make a basic ship (including from Carriers) or complete an upgraded ship. It can occur multiple times per turn. Is not activated by itself or other Dreadnoughts.',
    stackCaption: 'X damage',
    colour: 'Red',
    numberOfGraphics: 1
  },
  {
    id: 'LEV',
    name: 'Leviathan',
    species: 'Human',
    shipType: 'Upgraded',
    totalLineCost: 44,
    joiningLineCost: 12,
    componentShips: ['DEF', 'DEF', 'CAR(0)', 'CAR(0)', 'STA', 'STA'],
    numberOfPowers: 3,
    powers: [
      {
        subphase: 'Dice Manipulation',
        text: 'All dice rolls read as 6 for you.'
      },
      {
        subphase: 'Automatic',
        text: 'Deal 12 damage.'
      },
      {
        subphase: 'Automatic',
        text: 'Heal 12.'
      }
    ],
    extraRules: 'Carrier charges must all be used before upgrading. Overrides reroll powers.',
    stackCaption: 'X healing, X damage',
    colour: 'Purple',
    numberOfGraphics: 1
  },
  {
    id: 'XEN',
    name: 'Xenite',
    species: 'Xenite',
    shipType: 'Basic',
    totalLineCost: 2,
    numberOfPowers: 0,
    powers: [],
    stackCaption: 'No caption',
    colour: 'White',
    numberOfGraphics: 1
  },
  {
    id: 'ANT',
    name: 'Antlion',
    species: 'Xenite',
    shipType: 'Basic',
    totalLineCost: 3,
    numberOfPowers: 2,
    charges: 1,
    powers: [
      {
        subphase: 'Charge Declaration',
        text: 'Heal 3  (use 1 charge).'
      },
      {
        subphase: 'Charge Declaration',
        text: 'Deal 3 damage (use 1 charge).'
      }
    ],
    extraRules: 'Can hold charge.',
    stackCaption: '1/1 charges - X damage or X healing (on turn it\'s used) - no caption when depleted',
    colour: 'Pastel Orange',
    numberOfGraphics: 2
  },
  {
    id: 'MAN',
    name: 'Mantis',
    species: 'Xenite',
    shipType: 'Basic',
    totalLineCost: 4,
    numberOfPowers: 1,
    powers: [
      {
        subphase: 'Automatic',
        text: 'Heal 1 for every TWO of your Xenites.'
      }
    ],
    extraRules: 'Each Mantis can heal a maximum of 10 per turn.',
    stackCaption: 'X healing',
    colour: 'Pastel Green',
    numberOfGraphics: 1
  },
  {
    id: 'EVO',
    name: 'Evolver',
    species: 'Xenite',
    shipType: 'Basic',
    totalLineCost: 4,
    numberOfPowers: 1,
    powers: [
      {
        subphase: 'Drawing',
        text: 'When built and in each future build phase, may turn one Xenite into an Oxite or an Asterite.'
      }
    ],
    extraRules: 'If no Xenites available power cannot be used.',
    stackCaption: 'No caption',
    colour: 'Pastel Purple',
    numberOfGraphics: 1
  },
  {
    id: 'OXI',
    name: 'Oxite',
    species: 'Xenite',
    shipType: 'Basic - Evolved',
    totalLineCost: 2,
    numberOfPowers: 1,
    powers: [
      {
        subphase: 'Automatic',
        text: 'Heal 1.'
      }
    ],
    stackCaption: 'X healing',
    colour: 'White',
    numberOfGraphics: 1
  },
  {
    id: 'AST',
    name: 'Asterite',
    species: 'Xenite',
    shipType: 'Basic - Evolved',
    totalLineCost: 2,
    numberOfPowers: 1,
    powers: [
      {
        subphase: 'Automatic',
        text: 'Deal 1 damage.'
      }
    ],
    stackCaption: 'X damage',
    colour: 'White',
    numberOfGraphics: 1
  },
  {
    id: 'HEL',
    name: 'Hell Hornet',
    species: 'Xenite',
    shipType: 'Basic',
    totalLineCost: 6,
    numberOfPowers: 2,
    powers: [
      {
        subphase: 'Automatic',
        text: 'Deal 3 damage, once only on the turn it is built.'
      },
      {
        subphase: 'Automatic',
        text: 'Deal 1 damage for every TWO of your Xenites.'
      }
    ],
    stackCaption: 'X damage (include upon completion damage on turn it\'s built)',
    colour: 'Pastel Red',
    numberOfGraphics: 1
  },
  {
    id: 'BUG',
    name: 'Bug Breeder',
    species: 'Xenite',
    shipType: 'Basic',
    totalLineCost: 6,
    numberOfPowers: 1,
    charges: 4,
    powers: [
      {
        subphase: 'Ships That Build',
        text: 'Make a Xenite (use 1 charge).'
      }
    ],
    stackCaption: 'X/4 charges - no caption when depleted',
    colour: 'Pastel Blue',
    numberOfGraphics: 5
  },
  {
    id: 'ZEN',
    name: 'Zenith',
    species: 'Xenite',
    shipType: 'Basic',
    totalLineCost: 9,
    numberOfPowers: 3,
    powers: [
      {
        subphase: 'Drawing',
        text: 'When built, make an Antlion.'
      },
      {
        subphase: 'Ships That Build',
        text: 'Each future build phase: If dice roll is a 2, make a Xenite. If dice roll is a 3, make an Antlion. If dice roll is a 4, make two Xenites.'
      },
      {
        subphase: 'Upon Destruction',
        text: 'Upon destruction, make two Xenites.'
      }
    ],
    stackCaption: 'Caption only when dice roll triggers a ship: Made X Xenite(s), Made X Antlion(s)',
    colour: 'Pastel Yellow',
    numberOfGraphics: 1
  },
  {
    id: 'DSW',
    name: 'Defense Swarm',
    species: 'Xenite',
    shipType: 'Upgraded',
    totalLineCost: 9,
    joiningLineCost: 3,
    componentShips: ['XEN', 'XEN', 'XEN'],
    numberOfPowers: 1,
    powers: [
      {
        subphase: 'Automatic',
        text: 'Heal 3 OR At the start of this turn, if your health is lower than your opponent\'s health: Heal 7.'
      }
    ],
    stackCaption: 'X healing (Number of ships in stack x 3 OR 7)',
    colour: 'Green',
    numberOfGraphics: 1
  },
  {
    id: 'AAR',
    name: 'Antlion Array',
    species: 'Xenite',
    shipType: 'Upgraded',
    totalLineCost: 12,
    joiningLineCost: 3,
    componentShips: ['ANT(0)', 'ANT(0)', 'ANT(0)'],
    numberOfPowers: 1,
    powers: [
      {
        subphase: 'Automatic',
        text: 'Deal 3 damage OR At the start of this turn, if your health is lower than your opponent\'s health: Deal 7 damage.\n'
      }
    ],
    stackCaption: 'X damage (Number of ships in stack x 3 OR 7)',
    colour: 'Orange',
    numberOfGraphics: 1
  },
  {
    id: 'OXF',
    name: 'Oxite Face',
    species: 'Xenite',
    shipType: 'Upgraded',
    totalLineCost: 12,
    joiningLineCost: 4,
    componentShips: ['OXI', 'OXI', 'EVO'],
    numberOfPowers: 2,
    powers: [
      {
        subphase: 'Line Generation',
        text: 'Generate an additional line in each future build phase.'
      },
      {
        subphase: 'Automatic',
        text: 'Heal 1 for each TYPE of ship your opponent has.'
      }
    ],
    extraRules: 'TYPE are counted during End of Turn Resolution.',
    stackCaption: '+X lines, X healing',
    colour: 'Yellow',
    numberOfGraphics: 1
  },
  {
    id: 'ASF',
    name: 'Asterite Face',
    species: 'Xenite',
    shipType: 'Upgraded',
    totalLineCost: 12,
    joiningLineCost: 4,
    componentShips: ['AST', 'AST', 'EVO'],
    numberOfPowers: 2,
    powers: [
      {
        subphase: 'Line Generation',
        text: 'Generate an additional line in each future build phase.'
      },
      {
        subphase: 'Automatic',
        text: 'Deal 1 damage for each TYPE of ship your \nopponent has.'
      }
    ],
    extraRules: 'TYPE are counted during End of Turn Resolution.',
    stackCaption: '+X lines, X damage',
    colour: 'Blue',
    numberOfGraphics: 1
  },
  {
    id: 'SAC',
    name: 'Sacrificial Pool',
    species: 'Xenite',
    shipType: 'Upgraded',
    totalLineCost: 12,
    joiningLineCost: 4,
    componentShips: ['XEN', 'ANT(0)', 'ANT(0)'],
    numberOfPowers: 2,
    powers: [
      {
        subphase: 'Ships That Build',
        text: 'Each future build phase, may destroy one basic ship of yours and make a Xenite for every 3 lines in that ship (round down).'
      },
      {
        subphase: '(Passive)',
        text: 'Your ships cannot be destroyed by opponent powers.'
      }
    ],
    stackCaption: 'No caption',
    colour: 'Red',
    numberOfGraphics: 1
  },
  {
    id: 'QUE',
    name: 'Queen',
    species: 'Xenite',
    shipType: 'Upgraded',
    totalLineCost: 20,
    joiningLineCost: 6,
    componentShips: ['XEN', 'ANT(0)', 'ANT(0)', 'BUG(0)'],
    numberOfPowers: 2,
    powers: [
      {
        subphase: 'Ships That Build',
        text: 'Each future build phase, make a Xenite.'
      },
      {
        subphase: 'Automatic',
        text: 'Deal 3 damage for each ship you made this turn (not including the Xenite from this Queen).'
      }
    ],
    extraRules: 'Damage count includes: drawn ships, upgraded ships, and ships made from other Queens, Bug Breeders, Zeniths, Sacrificial Pools.',
    stackCaption: 'X damage',
    colour: 'Cyan',
    numberOfGraphics: 1
  },
  {
    id: 'CHR',
    name: 'Chronoswarm',
    species: 'Xenite',
    shipType: 'Upgraded',
    totalLineCost: 25,
    joiningLineCost: 4,
    componentShips: ['XEN', 'XEN', 'XEN', 'XEN', 'XEN', 'XEN', 'ZEN'],
    numberOfPowers: 3,
    powers: [
      {
        subphase: 'End of Build Phase',
        text: 'Each turn, before the battle phase, you take an extra build phase. (Includes Dice Roll, Ships That Build and Drawing, but not Face lines.)'
      },
      {
        subphase: '',
        text: 'If you have 2: Roll 2 dice in the extra build phase.'
      },
      {
        subphase: '',
        text: 'If you have 3: Roll 3 dice in the extra build phase.'
      }
    ],
    extraRules: 'Does not occur the turn it is built. Opponent sees the dice roll(s). If multiple players have Chronoswarms, they all use the same dice rolls. (For 2 and 3) Use only the last rolled dice for Zeniths - not each dice.',
    stackCaption: 'No caption',
    colour: 'Pink',
    numberOfGraphics: 1
  },
  {
    id: 'HVE',
    name: 'Hive',
    species: 'Xenite',
    shipType: 'Upgraded',
    totalLineCost: 35,
    joiningLineCost: 4,
    componentShips: ['XEN', 'ANT(0)', 'MAN', 'MAN', 'HEL', 'BUG(0)', 'BUG(0)'],
    numberOfPowers: 3,
    powers: [
      {
        subphase: 'Automatic',
        text: 'Deal 1 damage for each of your ships.'
      },
      {
        subphase: 'Automatic',
        text: 'Heal 1 for each of your ships.'
      },
      {
        subphase: '(Passive)',
        text: 'Xenites, Oxites and Asterites within your upgraded ships DO count for your other ship powers.'
      }
    ],
    stackCaption: 'X healing, X damage',
    colour: 'Purple',
    numberOfGraphics: 1
  },
  {
    id: 'FEA',
    name: 'Ship of Fear',
    species: 'Centaur',
    shipType: 'Basic',
    totalLineCost: 2,
    numberOfPowers: 1,
    powers: [
      {
        subphase: 'Automatic',
        text: 'Heal 4, once only on the turn it is built.'
      }
    ],
    stackCaption: 'X healing (only on turn it\'s built, then no caption)',
    colour: 'Pastel Green',
    numberOfGraphics: 1
  },
  {
    id: 'ANG',
    name: 'Ship of Anger',
    species: 'Centaur',
    shipType: 'Basic',
    totalLineCost: 3,
    numberOfPowers: 1,
    powers: [
      {
        subphase: 'Automatic',
        text: 'Deal 4 damage, once only on the turn it is built.'
      }
    ],
    stackCaption: 'X damage (only on turn it\'s built, then no caption)',
    colour: 'Pastel Red',
    numberOfGraphics: 1
  },
  {
    id: 'EQU',
    name: 'Ship of Equality',
    species: 'Centaur',
    shipType: 'Basic',
    totalLineCost: 4,
    numberOfPowers: 1,
    charges: 2,
    powers: [
      {
        subphase: 'Charge Declaration',
        text: 'Destroy one basic ship of yours, and one basic ship of your opponents with an EQUAL number of total lines \n(use 1 charge).'
      }
    ],
    extraRules: 'Mark as each charge is used. Cannot target other Ships of Equality. If there are not two valid targets, cannot be used. If either target is destroyed, charge is still used.',
    stackCaption: 'X/2 charges - no caption when depleted',
    colour: 'Pastel Orange',
    numberOfGraphics: 3
  },
  {
    id: 'WIS',
    name: 'Ship of Wisdom',
    species: 'Centaur',
    shipType: 'Basic',
    totalLineCost: 4,
    numberOfPowers: 2,
    charges: 2,
    powers: [
      {
        subphase: 'Charge Declaration',
        text: 'Deal 3 damage (use 1 charge).'
      },
      {
        subphase: 'Charge Declaration',
        text: 'Heal 4 (use 1 charge).'
      }
    ],
    stackCaption: 'X/2 charges - X damage or X healing (on turn it\'s used) - no caption when depleted',
    colour: 'Pastel Purple',
    numberOfGraphics: 3
  },
  {
    id: 'VIG',
    name: 'Ship of Vigor',
    species: 'Centaur',
    shipType: 'Basic',
    totalLineCost: 6,
    numberOfPowers: 1,
    powers: [
      {
        subphase: 'Line Generation',
        text: 'Each future build phase, if dice roll is even (2, 4, 6) generate TWO additional lines.'
      }
    ],
    extraRules: 'You can have a maximum of 3 Ships of Vigor.',
    stackCaption: '+X lines on even dice, no caption on odd dice',
    colour: 'Pastel Blue',
    numberOfGraphics: 1
  },
  {
    id: 'FAM',
    name: 'Ship of Family',
    species: 'Centaur',
    shipType: 'Basic',
    totalLineCost: 6,
    numberOfPowers: 2,
    charges: 3,
    powers: [
      {
        subphase: 'Charge Declaration',
        text: 'Deal 1 damage for each TYPE of ship you have\n(use 1 charge).'
      },
      {
        subphase: 'Charge Declaration',
        text: 'Heal 1 for each TYPE of ship you have (use 1 charge).'
      }
    ],
    extraRules: 'TYPE are counted during Charge Declaration.',
    stackCaption: 'X/3 charges - X damage or X healing (on turn it\'s used) - no caption when depleted',
    colour: 'Pastel Pink',
    numberOfGraphics: 4
  },
  {
    id: 'LEG',
    name: 'Ship of Legacy',
    species: 'Centaur',
    shipType: 'Basic',
    totalLineCost: 8,
    numberOfPowers: 3,
    powers: [
      {
        subphase: 'Drawing',
        text: 'When built, generate 4 joining lines.'
      },
      {
        subphase: 'Automatic',
        text: 'Deal 1 damage.'
      },
      {
        subphase: 'Automatic',
        text: 'Heal 2.'
      }
    ],
    extraRules: 'Joining lines can be drawn immediately or saved. These may only be used as joining lines. If they complete an upgraded ship it is active this turn.',
    stackCaption: 'X healing, X damage',
    colour: 'Pastel Yellow',
    numberOfGraphics: 1
  },
  {
    id: 'TER',
    name: 'Ark of Terror',
    species: 'Centaur',
    shipType: 'Upgraded',
    totalLineCost: 7,
    joiningLineCost: 3,
    componentShips: ['FEA', 'FEA'],
    numberOfPowers: 1,
    powers: [
      {
        subphase: 'Automatic',
        text: 'Heal equal to the dice roll this turn.'
      }
    ],
    stackCaption: 'X healing',
    colour: 'Green',
    numberOfGraphics: 1
  },
  {
    id: 'FUR',
    name: 'Ark of Fury',
    species: 'Centaur',
    shipType: 'Upgraded',
    totalLineCost: 10,
    joiningLineCost: 4,
    componentShips: ['ANG', 'ANG'],
    numberOfPowers: 1,
    powers: [
      {
        subphase: 'Automatic',
        text: 'Deal damage equal to the dice roll this turn.'
      }
    ],
    stackCaption: 'X damage',
    colour: 'Orange',
    numberOfGraphics: 1
  },
  {
    id: 'KNO',
    name: 'Ark of Knowledge',
    species: 'Centaur',
    shipType: 'Upgraded',
    totalLineCost: 12,
    joiningLineCost: 2,
    componentShips: ['WIS(0)', 'FAM(0)'],
    numberOfPowers: 3,
    powers: [
      {
        subphase: 'Dice Manipulation',
        text: 'If you have 1\n Ark of Knowledge: You may reroll the dice during build phase (for all players, the original roll \nis not used). If you have 2 Arks of Knowledge: You may reroll the dice TWICE during build phase (for all players, the original roll is not used).\n'
      },
      {
        subphase: 'Automatic',
        text: 'Heal 2.'
      },
      {
        subphase: 'Automatic',
        text: 'If you have 3\n Arks of Knowledge: Also your damage and healing are equal to whichever is higher this turn. Includes \'once only\' and charges.'
      }
    ],
    stackCaption: 'X healing, X damage',
    colour: 'Pink',
    numberOfGraphics: 1
  },
  {
    id: 'ENT',
    name: 'Ark of Entropy',
    species: 'Centaur',
    shipType: 'Upgraded',
    totalLineCost: 12,
    joiningLineCost: 4,
    componentShips: ['EQU(0)', 'EQU(0)'],
    numberOfPowers: 2,
    powers: [
      {
        subphase: 'Automatic',
        text: 'Deal 7 damage.'
      },
      {
        subphase: 'Automatic',
        text: 'Take 4 damage.'
      }
    ],
    stackCaption: 'X damage, take X',
    colour: 'Blue',
    numberOfGraphics: 1
  },
  {
    id: 'RED',
    name: 'Ark of Redemption',
    species: 'Centaur',
    shipType: 'Upgraded',
    totalLineCost: 15,
    joiningLineCost: 3,
    componentShips: ['WIS(0)', 'WIS(0)', 'WIS(0)'],
    numberOfPowers: 2,
    powers: [
      {
        subphase: 'Line Generation',
        text: 'Generate 2 joining lines each future build phase.'
      },
      {
        subphase: 'End of Build Phase',
        text: 'When built set your health to maximum. This is not \'healing\', and occurs before the Battle Phase. Does not affect Ark of Knowledge.'
      }
    ],
    stackCaption: '+X joining lines, X health',
    colour: 'Yellow',
    numberOfGraphics: 1
  },
  {
    id: 'POW',
    name: 'Ark of Power',
    species: 'Centaur',
    shipType: 'Upgraded',
    totalLineCost: 20,
    joiningLineCost: 6,
    componentShips: ['FEA', 'ANG', 'ANG', 'VIG'],
    numberOfPowers: 3,
    powers: [
      {
        subphase: 'Line Generation',
        text: 'Each future build phase, if dice roll is even (2, 4, 6) generate FOUR additional lines.'
      },
      {
        subphase: 'Automatic',
        text: 'Deal 2 damage.'
      },
      {
        subphase: 'Automatic',
        text: 'Heal 3.'
      }
    ],
    extraRules: 'You can have a maximum of 2 Arks of Power.\n',
    stackCaption: 'X healing, X damage, +X lines',
    colour: 'Cyan',
    numberOfGraphics: 1
  },
  {
    id: 'DES',
    name: 'Ark of Destruction',
    species: 'Centaur',
    shipType: 'Upgraded',
    totalLineCost: 31,
    joiningLineCost: 12,
    componentShips: ['FEA', 'FEA', 'ANG', 'EQU(0)', 'LEG'],
    numberOfPowers: 1,
    powers: [
      {
        subphase: 'Automatic',
        text: 'Deal 3 damage for each of your other ships. Does NOT include itself.'
      }
    ],
    stackCaption: 'X damage',
    colour: 'Red',
    numberOfGraphics: 1
  },
  {
    id: 'DOM',
    name: 'Ark of Domination',
    species: 'Centaur',
    shipType: 'Upgraded',
    totalLineCost: 40,
    joiningLineCost: 12,
    componentShips: ['FEA', 'VIG', 'FAM(0)', 'FAM(0)', 'LEG'],
    numberOfPowers: 3,
    powers: [
      {
        subphase: 'Line Generation',
        text: 'Generate 2 joining lines each future build phase.'
      },
      {
        subphase: 'First Strike',
        text: 'Once, on the turn it is built, at the start of the battle phase, take permanent control of TWO basic (non-upgraded) enemy ships.'
      },
      {
        subphase: 'Automatic',
        text: 'Heal 3 for each of your ships.'
      }
    ],
    extraRules: 'Enemy ships will be removed from their fleet and added to your fleet. Their Charge powers and Automatic powers will be active for you.',
    stackCaption: '+X joining lines, X health',
    colour: 'Purple',
    numberOfGraphics: 1
  },
  {
    id: 'MER',
    name: 'Mercury Core',
    species: 'Ancient',
    shipType: 'Basic',
    totalLineCost: 4,
    numberOfPowers: 1,
    powers: [
      {
        subphase: 'Charge Declaration',
        text: 'Gain 1 red energy each battle phase.'
      }
    ],
    stackCaption: 'N/A',
    colour: 'Pastel Red',
    numberOfGraphics: 1
  },
  {
    id: 'PLU',
    name: 'Pluto Core',
    species: 'Ancient',
    shipType: 'Basic',
    totalLineCost: 4,
    numberOfPowers: 1,
    powers: [
      {
        subphase: 'Charge Declaration',
        text: 'Gain 1 green energy each battle phase.'
      }
    ],
    stackCaption: 'N/A',
    colour: 'Pastel Green',
    numberOfGraphics: 1
  },
  {
    id: 'QUA',
    name: 'Quantum Mystic',
    species: 'Ancient',
    shipType: 'Basic',
    totalLineCost: 5,
    numberOfPowers: 2,
    powers: [
      {
        subphase: 'Charge Declaration',
        text: 'If dice roll is 1 or 2 Gain 1 blue energy.'
      },
      {
        subphase: 'Automatic',
        text: 'If dice roll is 1 or 2 heal 5.'
      }
    ],
    extraRules: 'You can have a maximum of 6 Quantum Mystics.',
    stackCaption: 'N/A',
    colour: 'Pastel Purple',
    numberOfGraphics: 1
  },
  {
    id: 'SPI',
    name: 'Spiral',
    species: 'Ancient',
    shipType: 'Basic',
    totalLineCost: 6,
    numberOfPowers: 3,
    powers: [
      {
        subphase: 'Automatic',
        text: 'If you have one:\n Heal 1 for each red and/or green energy you spent this turn.'
      },
      {
        subphase: '(passive)',
        text: 'If you have two:\n Also, increase your maximum health by 15.'
      },
      {
        subphase: 'Automatic',
        text: 'If you have three:\n Also, Deal 1 damage for each red and/or green energy you spent this turn.'
      }
    ],
    stackCaption: 'N/A',
    colour: 'Pastel Pink',
    numberOfGraphics: 1
  },
  {
    id: 'URA',
    name: 'Uranus Core',
    species: 'Ancient',
    shipType: 'Basic',
    totalLineCost: 7,
    numberOfPowers: 1,
    powers: [
      {
        subphase: 'Charge Declaration',
        text: 'Gain 1 blue energy each battle phase.'
      }
    ],
    extraRules: 'You can have a maximum of 6 Uranus Cores.',
    stackCaption: 'N/A',
    colour: 'Pastel Blue',
    numberOfGraphics: 1
  },
  {
    id: 'SOL',
    name: 'Solar Grid',
    species: 'Ancient',
    shipType: 'Basic',
    totalLineCost: 8,
    numberOfPowers: 2,
    charges: 4,
    powers: [
      {
        subphase: 'Charge Declaration',
        text: 'Gain 1 energy of each colour this battle phase \n(use 1 charge).'
      },
      {
        subphase: 'Automatic',
        text: 'When all charges have been used, heal 2 each turn.'
      }
    ],
    stackCaption: 'N/A',
    colour: 'Pastel Yellow',
    numberOfGraphics: 5
  },
  {
    id: 'CUB',
    name: 'Cube',
    species: 'Ancient',
    shipType: 'Basic',
    totalLineCost: 9,
    numberOfPowers: 1,
    powers: [
      {
        subphase: 'Charge Declaration',
        text: 'Once per turn, you may repeat a solar power that you cast (for free).'
      }
    ],
    stackCaption: 'N/A',
    colour: 'Pastel Orange',
    numberOfGraphics: 1
  },
  {
    id: 'SAST',
    name: 'Asteroid',
    species: 'Ancient',
    shipType: 'Solar Power',
    totalLineCost: null,
    joiningLineCost: null,
    componentShips: ['1 red energy'],
    numberOfPowers: 1,
    powers: [
      {
        subphase: 'Charge Declaration',
        text: 'Deal 1 damage.'
      }
    ],
    stackCaption: 'N/A',
    colour: 'N/A',
    numberOfGraphics: 0
  },
  {
    id: 'SSUP',
    name: 'Supernova',
    species: 'Ancient',
    shipType: 'Solar Power',
    totalLineCost: null,
    joiningLineCost: null,
    componentShips: ['3 red energy'],
    numberOfPowers: 1,
    powers: [
      {
        subphase: 'Charge Declaration',
        text: 'Deal damage equal to the dice roll +4.'
      }
    ],
    stackCaption: 'N/A',
    colour: 'N/A',
    numberOfGraphics: 0
  },
  {
    id: 'SLIF',
    name: 'Life',
    species: 'Ancient',
    shipType: 'Solar Power',
    totalLineCost: null,
    joiningLineCost: null,
    componentShips: ['1 green energy'],
    numberOfPowers: 1,
    powers: [
      {
        subphase: 'Charge Declaration',
        text: 'Heal 1.'
      }
    ],
    stackCaption: 'N/A',
    colour: 'N/A',
    numberOfGraphics: 0
  },
  {
    id: 'SSTA',
    name: 'Star Birth',
    species: 'Ancient',
    shipType: 'Solar Power',
    totalLineCost: null,
    joiningLineCost: null,
    componentShips: ['3 green energy'],
    numberOfPowers: 1,
    powers: [
      {
        subphase: 'Charge Declaration',
        text: 'Heal equal to the dice roll +5.'
      }
    ],
    stackCaption: 'N/A',
    colour: 'N/A',
    numberOfGraphics: 0
  },
  {
    id: 'SCON',
    name: 'Convert',
    species: 'Ancient',
    shipType: 'Solar Power',
    totalLineCost: null,
    joiningLineCost: null,
    componentShips: ['1 blue energy'],
    numberOfPowers: 1,
    powers: [
      {
        subphase: 'Charge Declaration',
        text: 'Generate an additional line next build phase.'
      }
    ],
    extraRules: '* Convert is the only way energy can be converted back into lines. Lines can be saved.',
    stackCaption: 'N/A',
    colour: 'N/A',
    numberOfGraphics: 0
  },
  {
    id: 'SSIM',
    name: 'Simulacrum',
    species: 'Ancient',
    shipType: 'Solar Power',
    totalLineCost: null,
    joiningLineCost: null,
    componentShips: ['X blue energy'],
    numberOfPowers: 1,
    powers: [
      {
        subphase: 'Charge Declaration',
        text: 'Make a copy of a basic enemy ship.\nX = Number of lines in ship.'
      }
    ],
    extraRules: 'Each ship may only be copied ONCE per turn. Ships with charges are copied as they are at the START of this turn. Copied ships CAN be upgraded. A Cube-cast makes an extra copy of target ship. Cannot copy Cube.',
    stackCaption: 'N/A',
    colour: 'N/A',
    numberOfGraphics: 0
  },
  {
    id: 'SSIP',
    name: 'Siphon',
    species: 'Ancient',
    shipType: 'Solar Power',
    totalLineCost: null,
    joiningLineCost: null,
    componentShips: ['2 red', '2 green energy'],
    numberOfPowers: 1,
    powers: [
      {
        subphase: 'Charge Declaration',
        text: 'Deal 1 damage for each Core you have.\nHeal 1 for each Core you have.'
      }
    ],
    stackCaption: 'N/A',
    colour: 'N/A',
    numberOfGraphics: 0
  },
  {
    id: 'SVOR',
    name: 'Vortex',
    species: 'Ancient',
    shipType: 'Solar Power',
    totalLineCost: null,
    joiningLineCost: null,
    componentShips: ['2 red', '2 green', '1 blue energy'],
    numberOfPowers: 1,
    powers: [
      {
        subphase: 'Charge Declaration',
        text: 'Deal 2 damage for each TYPE of ship you have.'
      }
    ],
    stackCaption: 'N/A',
    colour: 'N/A',
    numberOfGraphics: 0
  },
  {
    id: 'SBLA',
    name: 'Black Hole',
    species: 'Ancient',
    shipType: 'Solar Power',
    totalLineCost: null,
    joiningLineCost: null,
    componentShips: ['3 red', '3 green', '3 blue energy'],
    numberOfPowers: 1,
    powers: [
      {
        subphase: 'Charge Declaration',
        text: 'Destroy TWO of the opponent\'s basic ships.\nDeal 4 damage.'
      }
    ],
    stackCaption: 'N/A',
    colour: 'N/A',
    numberOfGraphics: 0
  }
];

// ============================================================================
// LOOKUP MAP
// ============================================================================

export const SHIP_DEFINITIONS_CORE_MAP: Record<string, ShipDefinitionCsv> = 
  PURE_SHIP_DEFINITIONS.reduce((map, def) => {
    map[def.id] = def;
    return map;
  }, {} as Record<string, ShipDefinitionCsv>);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get ship definition by ID
 */
export function getShipDefinitionById(shipDefId: string): ShipDefinitionCsv | undefined {
  return SHIP_DEFINITIONS_CORE_MAP[shipDefId];
}

/**
 * Alias for backward compatibility
 */
export function getShipById(shipDefId: string): ShipDefinitionCsv | undefined {
  return getShipDefinitionById(shipDefId);
}

/**
 * Get basic ship line cost
 */
export function getBasicShipCost(shipDefId: string): number | null {
  const ship = getShipDefinitionById(shipDefId);
  return ship?.totalLineCost ?? null;
}

/**
 * Get upgraded ship joining line cost
 */
export function getUpgradedShipCost(shipDefId: string): number | null {
  const ship = getShipDefinitionById(shipDefId);
  return ship?.joiningLineCost ?? null;
}

/**
 * Get total ship cost (joining or total)
 */
export function getShipCost(shipDefId: string): number | null {
  const ship = getShipDefinitionById(shipDefId);
  return ship?.joiningLineCost ?? ship?.totalLineCost ?? null;
}