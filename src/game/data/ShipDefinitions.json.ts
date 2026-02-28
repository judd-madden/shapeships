/**
 * CANONICAL SHIP DEFINITIONS (JSON SOURCE)
 * 
 * Single source of truth for all ship data.
 * Imported from authoritative JSON specification.
 * 
 * CRITICAL: Power text contains literal "\n" escape sequences.
 * Do NOT convert these to real newlines - preserve exactly as provided.
 * The UI layer is responsible for interpreting these sequences.
 * 
 * Created: 2026-01-16
 * Replaces: Legacy CSV-based ship definitions (archived)
 */

export const SHIP_DEFINITIONS_JSON = [
  {
    "id": "DEF",
    "species": "Human",
    "shipType": "Basic",
    "name": "Defender",
    "totalLineCost": 2,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": null,
    "powers": [
      {
        "subphase": "Automatic",
        "text": "Heal 1."
      }
    ],
    "energyCost": null,
    "extraRules": "",
    "stackCaption": "X healing",
    "colour": "Pastel Green",
    "numberOfGraphics": 1
  },
  {
    "id": "FIG",
    "species": "Human",
    "shipType": "Basic",
    "name": "Fighter",
    "totalLineCost": 3,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": null,
    "powers": [
      {
        "subphase": "Automatic",
        "text": "Deal 1 damage."
      }
    ],
    "energyCost": null,
    "extraRules": "",
    "stackCaption": "X damage",
    "colour": "Pastel Red",
    "numberOfGraphics": 1
  },
  {
    "id": "COM",
    "species": "Human",
    "shipType": "Basic",
    "name": "Commander",
    "totalLineCost": 4,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": null,
    "powers": [
      {
        "subphase": "Automatic",
        "text": "Deal 1 damage for every THREE of your Fighters."
      }
    ],
    "energyCost": null,
    "extraRules": "",
    "stackCaption": "X damage",
    "colour": "Pastel Orange",
    "numberOfGraphics": 1
  },
  {
    "id": "INT",
    "species": "Human",
    "shipType": "Basic",
    "name": "Interceptor",
    "totalLineCost": 4,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": 1,
    "powers": [
      {
        "subphase": "Charge Declaration",
        "text": "Interceptors have 1 charge:\\n- Deal 5 damage (uses charge) OR\\n- Heal 5 (uses charge)"
      }
    ],
    "energyCost": null,
    "extraRules": "Can hold charge. Interceptor will be marked when the charge has been used.",
    "stackCaption": "1/1 charges - X damage or X healing (on turn it's used) - no caption when depleted",
    "colour": "Pastel Purple",
    "numberOfGraphics": 2
  },
  {
    "id": "ORB",
    "species": "Human",
    "shipType": "Basic",
    "name": "Orbital",
    "totalLineCost": 6,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": null,
    "maxQuantity": 6,
    "powers": [
      {
        "subphase": "Line Generation",
        "text": "Generate an additional line in each future build phase."
      }
    ],
    "energyCost": null,
    "extraRules": "You can have a maximum of 6 Orbitals. Lines may be saved.",
    "stackCaption": "+X lines",
    "colour": "Pastel Blue",
    "numberOfGraphics": 1
  },
  {
    "id": "CAR",
    "species": "Human",
    "shipType": "Basic",
    "name": "Carrier",
    "totalLineCost": 6,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": 6,
    "powers": [
      {
        "subphase": "Ships That Build",
        "text": "Has 6 charges. In each future build phase, may:\\n- Make a Defender (use 1 charge) OR\\n- Make a Fighter (use 2 charges)"
      }
    ],
    "energyCost": null,
    "extraRules": "Carrier will be marked each time a charge is used.",
    "stackCaption": "X/6 charges - no caption when depleted",
    "colour": "Pastel Yellow",
    "numberOfGraphics": 7
  },
  {
    "id": "STA",
    "species": "Human",
    "shipType": "Basic",
    "name": "Starship",
    "totalLineCost": 8,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": null,
    "powers": [
      {
        "subphase": "Automatic",
        "text": "Deal 8 damage, once only on the turn it is built."
      }
    ],
    "energyCost": null,
    "extraRules": "",
    "stackCaption": "X damage (only on turn it's built, then no caption)",
    "colour": "Pastel Pink",
    "numberOfGraphics": 1
  },
  {
    "id": "FRI",
    "species": "Human",
    "shipType": "Upgraded",
    "name": "Frigate",
    "totalLineCost": 8,
    "joiningLineCost": 3,
    "componentShips": [
      "DEF",
      "FIG"
    ],
    "charges": null,
    "powers": [
      {
        "subphase": "Drawing",
        "text": "Choose a trigger number for this ship, 1-6."
      },
      {
        "subphase": "Automatic",
        "text": "If dice roll matches the trigger number, deal 6 damage. Including the turn this is built."
      },
      {
        "subphase": "Automatic",
        "text": "Heal 2."
      }
    ],
    "energyCost": null,
    "extraRules": "",
    "stackCaption": "X healing - HITS X damage",
    "colour": "Yellow",
    "numberOfGraphics": 1
  },
  {
    "id": "TAC",
    "species": "Human",
    "shipType": "Upgraded",
    "name": "Tactical Cruiser",
    "totalLineCost": 10,
    "joiningLineCost": 3,
    "componentShips": [
      "DEF",
      "DEF",
      "FIG"
    ],
    "charges": null,
    "powers": [
      {
        "subphase": "Automatic",
        "text": "Deal 1 damage for each TYPE of ship you have."
      }
    ],
    "energyCost": null,
    "extraRules": "Includes Tactical Cruiser as a type. Types are counted during End of Turn Resolution.",
    "stackCaption": "X damage",
    "colour": "Orange",
    "numberOfGraphics": 1
  },
  {
    "id": "GUA",
    "species": "Human",
    "shipType": "Upgraded",
    "name": "Guardian",
    "totalLineCost": 12,
    "joiningLineCost": 4,
    "componentShips": [
      "DEF",
      "DEF",
      "COM"
    ],
    "charges": 2,
    "powers": [
      {
        "subphase": "First Strike",
        "text": "Has 2 charges:\\n- Destroy a basic enemy ship (use 1 charge)."
      }
    ],
    "energyCost": null,
    "extraRules": "Guardian will be marked each time a charge is used. Cannot destroy upgraded ships. The Guardian power occurs during Battle Phase before other ship powers. See 'Destroying' rules for info.",
    "stackCaption": "X/2 charges - no caption when depleted",
    "colour": "Blue",
    "numberOfGraphics": 3
  },
  {
    "id": "SCI",
    "species": "Human",
    "shipType": "Upgraded",
    "name": "Science Vessel",
    "totalLineCost": 17,
    "joiningLineCost": 4,
    "componentShips": [
      "DEF",
      "FIG",
      "STA"
    ],
    "charges": null,
    "maxQuantity": 3,
    "powers": [
      {
        "subphase": "Automatic",
        "text": "If you have one:\\nDouble your healing."
      },
      {
        "subphase": "Automatic",
        "text": "If you have two:\\nAlso double your damage."
      },
      {
        "subphase": "Line Generation",
        "text": "If you have three:\\nAlso double the dice roll for you."
      }
    ],
    "energyCost": null,
    "extraRules": "Healing & Damage: Doubling does not apply to 'upon completion' or charge powers. Dice: Each future build phase, generate additional lines equal to the dice roll. (For Frigates, use dice number as read).",
    "stackCaption": "X healing, X damage, +X lines",
    "colour": "Pink",
    "numberOfGraphics": 1
  },
  {
    "id": "BAT",
    "species": "Human",
    "shipType": "Upgraded",
    "name": "Battle Cruiser",
    "totalLineCost": 20,
    "joiningLineCost": 6,
    "componentShips": [
      "DEF",
      "FIG",
      "FIG",
      "ORB"
    ],
    "charges": null,
    "powers": [
      {
        "subphase": "Line Generation",
        "text": "Generate 2 additional lines in each future build phase."
      },
      {
        "subphase": "Automatic",
        "text": "Heal 3."
      },
      {
        "subphase": "Automatic",
        "text": "Deal 2 damage."
      }
    ],
    "energyCost": null,
    "extraRules": "Lines may be saved.",
    "stackCaption": "X healing, X damage, +X lines",
    "colour": "Cyan",
    "numberOfGraphics": 1
  },
  {
    "id": "EAR",
    "species": "Human",
    "shipType": "Upgraded",
    "name": "Earth Ship",
    "totalLineCost": 23,
    "joiningLineCost": 7,
    "componentShips": [
      "DEF",
      "DEF",
      "ORB",
      "CAR(0)"
    ],
    "charges": null,
    "powers": [
      {
        "subphase": "Automatic",
        "text": "Deal 3 damage for each of your Carriers."
      }
    ],
    "energyCost": null,
    "extraRules": "Carrier charges must all be used before upgrading. Damage does not count Carriers within upgraded ships.",
    "stackCaption": "X damage",
    "colour": "Green",
    "numberOfGraphics": 1
  },
  {
    "id": "DRE",
    "species": "Human",
    "shipType": "Upgraded",
    "name": "Dreadnought",
    "totalLineCost": 27,
    "joiningLineCost": 10,
    "componentShips": [
      "DEF",
      "DEF",
      "FIG",
      "FIG",
      "FIG",
      "COM"
    ],
    "charges": null,
    "powers": [
      {
        "subphase": "Drawing",
        "text": "When you complete a ship, you may make a FREE additional Fighter."
      },
      {
        "subphase": "Automatic",
        "text": "Deal 10 damage."
      }
    ],
    "energyCost": null,
    "extraRules": "The Dreadnought's build power activates whenever you make a basic ship (including from Carriers) or complete an upgraded ship. It can occur multiple times per turn. Is not activated by itself or other Dreadnoughts.",
    "stackCaption": "X damage",
    "colour": "Red",
    "numberOfGraphics": 1
  },
  {
    "id": "LEV",
    "species": "Human",
    "shipType": "Upgraded",
    "name": "Leviathan",
    "totalLineCost": 44,
    "joiningLineCost": 12,
    "componentShips": [
      "DEF",
      "DEF",
      "CAR(0)",
      "CAR(0)",
      "STA",
      "STA"
    ],
    "charges": null,
    "powers": [
      {
        "subphase": "Dice Manipulation",
        "text": "All dice rolls read as 6 for you."
      },
      {
        "subphase": "Automatic",
        "text": "Deal 12 damage."
      },
      {
        "subphase": "Automatic",
        "text": "Heal 12."
      }
    ],
    "energyCost": null,
    "extraRules": "Carrier charges must all be used before upgrading. Overrides reroll powers.",
    "stackCaption": "X healing, X damage",
    "colour": "Purple",
    "numberOfGraphics": 1
  },
  {
    "id": "XEN",
    "species": "Xenite",
    "shipType": "Basic",
    "name": "Xenite",
    "totalLineCost": 2,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": null,
    "powers": [
      {
        "subphase": "Automatic",
        "text": "Heal 1, once only on the turn it is built."
      }
    ],
    "energyCost": null,
    "extraRules": "",
    "stackCaption": "1 healing (only on turn it's built, then no caption)",
    "colour": "White",
    "numberOfGraphics": 1
  },
  {
    "id": "ANT",
    "species": "Xenite",
    "shipType": "Basic",
    "name": "Antlion",
    "totalLineCost": 3,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": 1,
    "powers": [
      {
        "subphase": "Charge Declaration",
        "text": "Has 1 charge:\\n- Deal 3 damage (uses charge) OR\\n- Heal 4 (uses charge)"
      }
    ],
    "energyCost": null,
    "extraRules": "Can hold charge. Antlion will be marked when the charge has been used.",
    "stackCaption": "1/1 charges - X damage or X healing (on turn it's used) - no caption when depleted",
    "colour": "Pastel Orange",
    "numberOfGraphics": 2
  },
  {
    "id": "MAN",
    "species": "Xenite",
    "shipType": "Basic",
    "name": "Mantis",
    "totalLineCost": 4,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": null,
    "powers": [
      {
        "subphase": "Automatic",
        "text": "Heal 1 for every TWO of your Xenites."
      }
    ],
    "energyCost": null,
    "extraRules": "Each Mantis can heal a maximum of 10 per turn.",
    "stackCaption": "X healing",
    "colour": "Pastel Green",
    "numberOfGraphics": 1
  },
  {
    "id": "EVO",
    "species": "Xenite",
    "shipType": "Basic",
    "name": "Evolver",
    "totalLineCost": 4,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": null,
    "powers": [
      {
        "subphase": "Drawing",
        "text": "When built and in each future build phase, may turn one Xenite into an Oxite or an Asterite."
      }
    ],
    "energyCost": null,
    "extraRules": "",
    "stackCaption": "No caption",
    "colour": "Pastel Purple",
    "numberOfGraphics": 1
  },
  {
    "id": "OXI",
    "species": "Xenite",
    "shipType": "Basic - Evolved",
    "name": "Oxite",
    "totalLineCost": 2,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": null,
    "powers": [
      {
        "subphase": "Automatic",
        "text": "Heal 1."
      }
    ],
    "energyCost": null,
    "extraRules": "",
    "stackCaption": "X healing",
    "colour": "White",
    "numberOfGraphics": 1
  },
  {
    "id": "AST",
    "species": "Xenite",
    "shipType": "Basic - Evolved",
    "name": "Asterite",
    "totalLineCost": 2,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": null,
    "powers": [
      {
        "subphase": "Automatic",
        "text": "Deal 1 damage."
      }
    ],
    "energyCost": null,
    "extraRules": "",
    "stackCaption": "X damage",
    "colour": "White",
    "numberOfGraphics": 1
  },
  {
    "id": "HEL",
    "species": "Xenite",
    "shipType": "Basic",
    "name": "Hell Hornet",
    "totalLineCost": 6,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": null,
    "powers": [
      {
        "subphase": "Automatic",
        "text": "Deal 3 damage, once only on the turn it is built."
      },
      {
        "subphase": "Automatic",
        "text": "Deal 1 damage for every TWO of your Xenites."
      }
    ],
    "energyCost": null,
    "extraRules": "",
    "stackCaption": "X damage (include upon completion damage on turn it's built)",
    "colour": "Pastel Red",
    "numberOfGraphics": 1
  },
  {
    "id": "BUG",
    "species": "Xenite",
    "shipType": "Basic",
    "name": "Bug Breeder",
    "totalLineCost": 6,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": 4,
    "powers": [
      {
        "subphase": "Ships That Build",
        "text": "Has 4 charges. In each future build phase, may:\\n- Make a Xenite (use 1 charge)"
      }
    ],
    "energyCost": null,
    "extraRules": "Bug Breeder will be marked when a charge is used.",
    "stackCaption": "X/4 charges - no caption when depleted",
    "colour": "Pastel Blue",
    "numberOfGraphics": 5
  },
  {
    "id": "ZEN",
    "species": "Xenite",
    "shipType": "Basic",
    "name": "Zenith",
    "totalLineCost": 9,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": null,
    "powers": [
      {
        "subphase": "Drawing",
        "text": "When built, make an Antlion."
      },
      {
        "subphase": "Ships That Build",
        "text": "Each future build phase:\\nIf dice roll is a 2, make a Xenite.\\nIf dice roll is a 3, make an Antlion.\\nIf dice roll is a 4, make two Xenites."
      },
      {
        "subphase": "Upon Destruction",
        "text": "Upon destruction, make two Xenites."
      }
    ],
    "energyCost": null,
    "extraRules": "",
    "stackCaption": "Caption only when dice roll triggers a ship: Made X Xenite(s), Made X Antlion(s)",
    "colour": "Pastel Yellow",
    "numberOfGraphics": 1
  },
  {
    "id": "DSW",
    "species": "Xenite",
    "shipType": "Upgraded",
    "name": "Defense Swarm",
    "totalLineCost": 9,
    "joiningLineCost": 3,
    "componentShips": [
      "XEN",
      "XEN",
      "XEN"
    ],
    "charges": null,
    "powers": [
      {
        "subphase": "Automatic",
        "text": "Heal 3 OR\\nAt the start of this turn, if your health is lower than your opponent's health: Heal 7."
      }
    ],
    "energyCost": null,
    "extraRules": "",
    "stackCaption": "X healing (Number of ships in stack x 3 OR 7)",
    "colour": "Green",
    "numberOfGraphics": 1
  },
  {
    "id": "AAR",
    "species": "Xenite",
    "shipType": "Upgraded",
    "name": "Antlion Array",
    "totalLineCost": 12,
    "joiningLineCost": 3,
    "componentShips": [
      "ANT(0)",
      "ANT(0)",
      "ANT(0)"
    ],
    "charges": null,
    "powers": [
      {
        "subphase": "Automatic",
        "text": "Deal 3 damage OR\\nAt the start of this turn, if your health is lower than your opponent's health: Deal 7 damage."
      }
    ],
    "energyCost": null,
    "extraRules": "",
    "stackCaption": "X damage (Number of ships in stack x 3 OR 7)",
    "colour": "Orange",
    "numberOfGraphics": 1
  },
  {
    "id": "OXF",
    "species": "Xenite",
    "shipType": "Upgraded",
    "name": "Oxite Face",
    "totalLineCost": 12,
    "joiningLineCost": 4,
    "componentShips": [
      "OXI",
      "OXI",
      "EVO"
    ],
    "charges": null,
    "powers": [
      {
        "subphase": "Line Generation",
        "text": "Generate an additional line in each future build phase."
      },
      {
        "subphase": "Automatic",
        "text": "Heal 1 for each TYPE of ship your opponent has."
      }
    ],
    "energyCost": null,
    "extraRules": "Types are counted during End of Turn Resolution. Does NOT include Chronoswarm build phase.",
    "stackCaption": "+X lines, X healing",
    "colour": "Yellow",
    "numberOfGraphics": 1
  },
  {
    "id": "ASF",
    "species": "Xenite",
    "shipType": "Upgraded",
    "name": "Asterite Face",
    "totalLineCost": 12,
    "joiningLineCost": 4,
    "componentShips": [
      "AST",
      "AST",
      "EVO"
    ],
    "charges": null,
    "powers": [
      {
        "subphase": "Line Generation",
        "text": "Generate an additional line in each future build phase."
      },
      {
        "subphase": "Automatic",
        "text": "Deal 1 damage for each TYPE of ship your opponent has."
      }
    ],
    "energyCost": null,
    "extraRules": "Types are counted during End of Turn Resolution. Does NOT include Chronoswarm build phase.",
    "stackCaption": "+X lines, X damage",
    "colour": "Blue",
    "numberOfGraphics": 1
  },
  {
    "id": "SAC",
    "species": "Xenite",
    "shipType": "Upgraded",
    "name": "Sacrificial Pool",
    "totalLineCost": 12,
    "joiningLineCost": 4,
    "componentShips": [
      "XEN",
      "ANT(0)",
      "ANT(0)"
    ],
    "charges": null,
    "powers": [
      {
        "subphase": "Ships That Build",
        "text": "Each future build phase, may destroy one basic ship of yours and make a Xenite for every 3 lines in that ship (round down)."
      },
      {
        "subphase": "Passive",
        "text": "Your ships cannot be destroyed by opponent powers."
      }
    ],
    "energyCost": null,
    "extraRules": "",
    "stackCaption": "No caption",
    "colour": "Red",
    "numberOfGraphics": 1
  },
  {
    "id": "QUE",
    "species": "Xenite",
    "shipType": "Upgraded",
    "name": "Queen",
    "totalLineCost": 20,
    "joiningLineCost": 6,
    "componentShips": [
      "XEN",
      "ANT(0)",
      "ANT(0)",
      "BUG(0)"
    ],
    "charges": null,
    "powers": [
      {
        "subphase": "Ships That Build",
        "text": "Each future build phase, make a Xenite."
      },
      {
        "subphase": "Automatic",
        "text": "Deal 3 damage for each ship you made this turn (not including the Xenite from this Queen)."
      }
    ],
    "energyCost": null,
    "extraRules": "Damage count includes: drawn ships, upgraded ships, and ships made from other Queens, Bug Breeders, Zeniths, Sacrificial Pools.",
    "stackCaption": "X damage",
    "colour": "Cyan",
    "numberOfGraphics": 1
  },
  {
    "id": "CHR",
    "species": "Xenite",
    "shipType": "Upgraded",
    "name": "Chronoswarm",
    "totalLineCost": 25,
    "joiningLineCost": 4,
    "componentShips": [
      "XEN",
      "XEN",
      "XEN",
      "XEN",
      "XEN",
      "XEN",
      "ZEN"
    ],
    "charges": null,
    "maxQuantity": 3,
    "powers": [
      {
        "subphase": "End of Build Phase",
        "text": "Each turn, before the battle phase, you take an extra build phase. (Includes Dice Roll, Ships That Build and Drawing, but not Face lines.)"
      },
      {
        "subphase": "End of Build Phase",
        "text": "If you have 2: Roll 2 dice in the extra build phase."
      },
      {
        "subphase": "End of Build Phase",
        "text": "If you have 3: Roll 3 dice in the extra build phase."
      }
    ],
    "energyCost": null,
    "extraRules": "Does not occur the turn it is built. Opponent sees the dice roll(s). If multiple players have Chronoswarms, they all use the same dice rolls. (For 2 and 3) Use only the last rolled dice for Zeniths - not each dice.",
    "stackCaption": "No caption",
    "colour": "Pink",
    "numberOfGraphics": 1
  },
  {
    "id": "HVE",
    "species": "Xenite",
    "shipType": "Upgraded",
    "name": "Hive",
    "totalLineCost": 35,
    "joiningLineCost": 4,
    "componentShips": [
      "XEN",
      "ANT(0)",
      "MAN",
      "MAN",
      "HEL",
      "BUG(0)",
      "BUG(0)"
    ],
    "charges": null,
    "powers": [
      {
        "subphase": "Automatic",
        "text": "Deal 1 damage for each of your ships."
      },
      {
        "subphase": "Automatic",
        "text": "Heal 1 for each of your ships."
      },
      {
        "subphase": "Passive",
        "text": "Xenites, Oxites and Asterites within your upgraded ships DO count for your other ship powers."
      }
    ],
    "energyCost": null,
    "extraRules": "",
    "stackCaption": "X healing, X damage",
    "colour": "Purple",
    "numberOfGraphics": 1
  },
  {
    "id": "FEA",
    "species": "Centaur",
    "shipType": "Basic",
    "name": "Ship of Fear",
    "totalLineCost": 2,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": null,
    "powers": [
      {
        "subphase": "Automatic",
        "text": "Heal 4, once only on the turn it is built."
      }
    ],
    "energyCost": null,
    "extraRules": "",
    "stackCaption": "X healing (only on turn it's built, then no caption)",
    "colour": "Pastel Green",
    "numberOfGraphics": 1
  },
  {
    "id": "ANG",
    "species": "Centaur",
    "shipType": "Basic",
    "name": "Ship of Anger",
    "totalLineCost": 3,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": null,
    "powers": [
      {
        "subphase": "Automatic",
        "text": "Deal 4 damage, once only on the turn it is built."
      }
    ],
    "energyCost": null,
    "extraRules": "",
    "stackCaption": "X damage (only on turn it's built, then no caption)",
    "colour": "Pastel Red",
    "numberOfGraphics": 1
  },
  {
    "id": "EQU",
    "species": "Centaur",
    "shipType": "Basic",
    "name": "Ship of Equality",
    "totalLineCost": 4,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": 2,
    "powers": [
      {
        "subphase": "Charge Declaration",
        "text": "Has 2 charges:\\n- Destroy one basic ship of yours, and one basic ship of your opponents with an EQUAL line cost (use 1 charge)."
      }
    ],
    "energyCost": null,
    "extraRules": "Will be marked when a charge is used. Cannot target other Ships of Equality. If there are not two valid targets, cannot be used. If either target is destroyed, charge is still used.",
    "stackCaption": "X/2 charges - no caption when depleted",
    "colour": "Pastel Orange",
    "numberOfGraphics": 3
  },
  {
    "id": "WIS",
    "species": "Centaur",
    "shipType": "Basic",
    "name": "Ship of Wisdom",
    "totalLineCost": 4,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": 2,
    "powers": [
      {
        "subphase": "Charge Declaration",
        "text": "Has 2 charges:\\n- Deal 3 damage (use 1 charge) OR\\n- Heal 4 (use 1 charge)"
      }
    ],
    "energyCost": null,
    "extraRules": "",
    "stackCaption": "X/2 charges - X damage or X healing (on turn it's used) - no caption when depleted",
    "colour": "Pastel Purple",
    "numberOfGraphics": 3
  },
  {
    "id": "VIG",
    "species": "Centaur",
    "shipType": "Basic",
    "name": "Ship of Vigor",
    "totalLineCost": 6,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": null,
    "maxQuantity": 3,
    "powers": [
      {
        "subphase": "Line Generation",
        "text": "Each future build phase, if dice roll is even (2, 4, 6) generate TWO additional lines."
      }
    ],
    "energyCost": null,
    "extraRules": "You can have a maximum of 3 Ships of Vigor. Lines can be saved.",
    "stackCaption": "+X lines on even dice, no caption on odd dice",
    "colour": "Pastel Blue",
    "numberOfGraphics": 1
  },
  {
    "id": "FAM",
    "species": "Centaur",
    "shipType": "Basic",
    "name": "Ship of Family",
    "totalLineCost": 6,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": 3,
    "powers": [
      {
        "subphase": "Charge Declaration",
        "text": "Has 3 charges:\\n- Deal 1 damage for each TYPE of ship you have (use 1 charge) OR\\n- Heal 1 for each TYPE of ship you have (use 1 charge)"
      }
    ],
    "energyCost": null,
    "extraRules": "Types are counted during Charge Declaration.",
    "stackCaption": "X/3 charges - X damage or X healing (on turn it's used) - no caption when depleted",
    "colour": "Pastel Pink",
    "numberOfGraphics": 4
  },
  {
    "id": "LEG",
    "species": "Centaur",
    "shipType": "Basic",
    "name": "Ship of Legacy",
    "totalLineCost": 8,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": null,
    "powers": [
      {
        "subphase": "Drawing",
        "text": "When built, generate 4 joining lines."
      },
      {
        "subphase": "Automatic",
        "text": "Deal 1 damage."
      },
      {
        "subphase": "Automatic",
        "text": "Heal 2."
      }
    ],
    "energyCost": null,
    "extraRules": "Joining lines can be drawn immediately or saved. These may only be used as joining lines. If they complete an upgraded ship it is active this turn.",
    "stackCaption": "X healing, X damage",
    "colour": "Pastel Yellow",
    "numberOfGraphics": 1
  },
  {
    "id": "TER",
    "species": "Centaur",
    "shipType": "Upgraded",
    "name": "Ark of Terror",
    "totalLineCost": 7,
    "joiningLineCost": 3,
    "componentShips": [
      "FEA",
      "FEA"
    ],
    "charges": null,
    "powers": [
      {
        "subphase": "Automatic",
        "text": "Heal equal to the dice roll this turn."
      }
    ],
    "energyCost": null,
    "extraRules": "",
    "stackCaption": "X healing",
    "colour": "Green",
    "numberOfGraphics": 1
  },
  {
    "id": "FUR",
    "species": "Centaur",
    "shipType": "Upgraded",
    "name": "Ark of Fury",
    "totalLineCost": 10,
    "joiningLineCost": 4,
    "componentShips": [
      "ANG",
      "ANG"
    ],
    "charges": null,
    "powers": [
      {
        "subphase": "Automatic",
        "text": "Deal damage equal to the dice roll this turn."
      }
    ],
    "energyCost": null,
    "extraRules": "",
    "stackCaption": "X damage",
    "colour": "Orange",
    "numberOfGraphics": 1
  },
  {
    "id": "KNO",
    "species": "Centaur",
    "shipType": "Upgraded",
    "name": "Ark of Knowledge",
    "totalLineCost": 12,
    "joiningLineCost": 2,
    "componentShips": [
      "WIS(0)",
      "FAM(0)"
    ],
    "charges": null,
    "maxQuantity": 3,
    "powers": [
      {
        "subphase": "Dice Manipulation",
        "text": "If you have one: You may reroll the dice during build phase.\\\\nIf you have two: You may reroll the dice TWICE during build phase"
      },
      {
        "subphase": "Automatic",
        "text": "If you have three: Also your damage and healing are equal to whichever is higher this turn. Includes 'once only', automatic, and charges."
      },
      {
        "subphase": "Automatic",
        "text": "Heal 2."
      }
    ],
    "energyCost": null,
    "extraRules": "Dice reroll is for all players, the original roll is not used. If both players have Arks of Knowledge then they can each choose to reroll. Cannot reroll Chronoswarm rolls. Leviathan overrules.",
    "stackCaption": "X healing, X damage",
    "colour": "Pink",
    "numberOfGraphics": 1
  },
  {
    "id": "ENT",
    "species": "Centaur",
    "shipType": "Upgraded",
    "name": "Ark of Entropy",
    "totalLineCost": 12,
    "joiningLineCost": 4,
    "componentShips": [
      "EQU(0)",
      "EQU(0)"
    ],
    "charges": null,
    "powers": [
      {
        "subphase": "Automatic",
        "text": "Deal 7 damage."
      },
      {
        "subphase": "Automatic",
        "text": "Take 4 damage."
      }
    ],
    "energyCost": null,
    "extraRules": "",
    "stackCaption": "X damage, take X",
    "colour": "Blue",
    "numberOfGraphics": 1
  },
  {
    "id": "RED",
    "species": "Centaur",
    "shipType": "Upgraded",
    "name": "Ark of Redemption",
    "totalLineCost": 15,
    "joiningLineCost": 3,
    "componentShips": [
      "WIS(0)",
      "WIS(0)",
      "WIS(0)"
    ],
    "charges": null,
    "powers": [
      {
        "subphase": "Line Generation",
        "text": "Generate 2 joining lines each future build phase."
      },
      {
        "subphase": "End of Build Phase",
        "text": "When built set your health to maximum. This is not 'healing', and occurs before the Battle Phase. Does not affect Ark of Knowledge."
      }
    ],
    "energyCost": null,
    "extraRules": "",
    "stackCaption": "+X joining lines, X health",
    "colour": "Yellow",
    "numberOfGraphics": 1
  },
  {
    "id": "POW",
    "species": "Centaur",
    "shipType": "Upgraded",
    "name": "Ark of Power",
    "totalLineCost": 20,
    "joiningLineCost": 6,
    "componentShips": [
      "FEA",
      "ANG",
      "ANG",
      "VIG"
    ],
    "charges": null,
    "maxQuantity": 2,
    "powers": [
      {
        "subphase": "Line Generation",
        "text": "Each future build phase, if dice roll is even (2, 4, 6) generate FOUR additional lines."
      },
      {
        "subphase": "Automatic",
        "text": "Deal 2 damage."
      },
      {
        "subphase": "Automatic",
        "text": "Heal 3."
      }
    ],
    "energyCost": null,
    "extraRules": "You can have a maximum of 2 Arks of Power. Lines can be saved.",
    "stackCaption": "X healing, X damage, +X lines",
    "colour": "Cyan",
    "numberOfGraphics": 1
  },
  {
    "id": "DES",
    "species": "Centaur",
    "shipType": "Upgraded",
    "name": "Ark of Destruction",
    "totalLineCost": 31,
    "joiningLineCost": 12,
    "componentShips": [
      "FEA",
      "FEA",
      "ANG",
      "EQU(0)",
      "LEG"
    ],
    "charges": null,
    "powers": [
      {
        "subphase": "Automatic",
        "text": "Deal 3 damage for each of your other ships. Does NOT include itself."
      }
    ],
    "energyCost": null,
    "extraRules": "",
    "stackCaption": "X damage",
    "colour": "Red",
    "numberOfGraphics": 1
  },
  {
    "id": "DOM",
    "species": "Centaur",
    "shipType": "Upgraded",
    "name": "Ark of Domination",
    "totalLineCost": 40,
    "joiningLineCost": 12,
    "componentShips": [
      "FEA",
      "VIG",
      "FAM(0)",
      "FAM(0)",
      "LEG"
    ],
    "charges": null,
    "powers": [
      {
        "subphase": "Line Generation",
        "text": "Generate 2 joining lines each future build phase."
      },
      {
        "subphase": "First Strike",
        "text": "Once, on the turn it is built, at the start of the battle phase, take permanent control of TWO basic (non-upgraded) enemy ships."
      },
      {
        "subphase": "Automatic",
        "text": "Heal 3 for each of your ships."
      }
    ],
    "energyCost": null,
    "extraRules": "Enemy ships will be removed from their fleet and added to your fleet. Their Charge powers and Automatic powers will be active for you.",
    "stackCaption": "+X joining lines, X health",
    "colour": "Purple",
    "numberOfGraphics": 1
  },
  {
    "id": "MER",
    "species": "Ancient",
    "shipType": "Basic",
    "name": "Mercury Core",
    "totalLineCost": 4,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": null,
    "powers": [
      {
        "subphase": "Charge Declaration",
        "text": "Gain 1 red energy each battle phase."
      }
    ],
    "energyCost": null,
    "extraRules": "",
    "stackCaption": "N/A",
    "colour": "Pastel Red",
    "numberOfGraphics": 1
  },
  {
    "id": "PLU",
    "species": "Ancient",
    "shipType": "Basic",
    "name": "Pluto Core",
    "totalLineCost": 4,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": null,
    "powers": [
      {
        "subphase": "Charge Declaration",
        "text": "Gain 1 green energy each battle phase."
      }
    ],
    "energyCost": null,
    "extraRules": "",
    "stackCaption": "N/A",
    "colour": "Pastel Green",
    "numberOfGraphics": 1
  },
  {
    "id": "QUA",
    "species": "Ancient",
    "shipType": "Basic",
    "name": "Quantum Mystic",
    "totalLineCost": 5,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": null,
    "maxQuantity": 6,
    "powers": [
      {
        "subphase": "Charge Declaration",
        "text": "If dice roll is 1 or 2 Gain 1 blue energy."
      },
      {
        "subphase": "Automatic",
        "text": "If dice roll is 1 or 2 heal 5."
      }
    ],
    "energyCost": null,
    "extraRules": "You can have a maximum of 6 Quantum Mystics.",
    "stackCaption": "N/A",
    "colour": "Pastel Purple",
    "numberOfGraphics": 1
  },
  {
    "id": "SPI",
    "species": "Ancient",
    "shipType": "Basic",
    "name": "Spiral",
    "totalLineCost": 6,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": null,
    "powers": [
      {
        "subphase": "Automatic",
        "text": "If you have one:\\nHeal 1 for each red and/or green energy you spent this turn."
      },
      {
        "subphase": "Passive",
        "text": "If you have two:\\nAlso, increase your maximum health by 15."
      },
      {
        "subphase": "Automatic",
        "text": "If you have three:\\nAlso, Deal 1 damage for each red and/or green energy you spent this turn."
      }
    ],
    "energyCost": null,
    "extraRules": "",
    "stackCaption": "N/A",
    "colour": "Pastel Pink",
    "numberOfGraphics": 1
  },
  {
    "id": "URA",
    "species": "Ancient",
    "shipType": "Basic",
    "name": "Uranus Core",
    "totalLineCost": 7,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": null,
    "maxQuantity": 6,
    "powers": [
      {
        "subphase": "Charge Declaration",
        "text": "Gain 1 blue energy each battle phase."
      }
    ],
    "energyCost": null,
    "extraRules": "You can have a maximum of 6 Uranus Cores.",
    "stackCaption": "N/A",
    "colour": "Pastel Blue",
    "numberOfGraphics": 1
  },
  {
    "id": "SOL",
    "species": "Ancient",
    "shipType": "Basic",
    "name": "Solar Grid",
    "totalLineCost": 8,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": 4,
    "powers": [
      {
        "subphase": "Charge Declaration",
        "text": "Has 4 charges:\\n- Gain 1 energy of each colour this battle phase (use 1 charge)."
      },
      {
        "subphase": "Automatic",
        "text": "When all charges have been used, heal 2 each turn."
      }
    ],
    "energyCost": null,
    "extraRules": "",
    "stackCaption": "N/A",
    "colour": "Pastel Yellow",
    "numberOfGraphics": 5
  },
  {
    "id": "CUB",
    "species": "Ancient",
    "shipType": "Basic",
    "name": "Cube",
    "totalLineCost": 9,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": null,
    "powers": [
      {
        "subphase": "Charge Declaration",
        "text": "Once per turn, you may repeat a solar power that you cast (for free)."
      }
    ],
    "energyCost": null,
    "extraRules": "",
    "stackCaption": "N/A",
    "colour": "Pastel Orange",
    "numberOfGraphics": 1
  },
  {
    "id": "SAST",
    "species": "Ancient",
    "shipType": "Solar Power",
    "name": "Asteroid",
    "totalLineCost": null,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": null,
    "powers": [
      {
        "subphase": "Charge Declaration",
        "text": "Deal 1 damage."
      }
    ],
    "energyCost": {
      "red": 1,
      "green": 0,
      "blue": 0,
      "xBlue": false
    },
    "extraRules": "",
    "stackCaption": "N/A",
    "colour": "N/A",
    "numberOfGraphics": 0
  },
  {
    "id": "SSUP",
    "species": "Ancient",
    "shipType": "Solar Power",
    "name": "Supernova",
    "totalLineCost": null,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": null,
    "powers": [
      {
        "subphase": "Charge Declaration",
        "text": "Deal damage equal to the dice roll +4."
      }
    ],
    "energyCost": {
      "red": 3,
      "green": 0,
      "blue": 0,
      "xBlue": false
    },
    "extraRules": "",
    "stackCaption": "N/A",
    "colour": "N/A",
    "numberOfGraphics": 0
  },
  {
    "id": "SLIF",
    "species": "Ancient",
    "shipType": "Solar Power",
    "name": "Life",
    "totalLineCost": null,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": null,
    "powers": [
      {
        "subphase": "Charge Declaration",
        "text": "Heal 1."
      }
    ],
    "energyCost": {
      "red": 0,
      "green": 1,
      "blue": 0,
      "xBlue": false
    },
    "extraRules": "",
    "stackCaption": "N/A",
    "colour": "N/A",
    "numberOfGraphics": 0
  },
  {
    "id": "SSTA",
    "species": "Ancient",
    "shipType": "Solar Power",
    "name": "Star Birth",
    "totalLineCost": null,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": null,
    "powers": [
      {
        "subphase": "Charge Declaration",
        "text": "Heal equal to the dice roll +5."
      }
    ],
    "energyCost": {
      "red": 0,
      "green": 3,
      "blue": 0,
      "xBlue": false
    },
    "extraRules": "",
    "stackCaption": "N/A",
    "colour": "N/A",
    "numberOfGraphics": 0
  },
  {
    "id": "SCON",
    "species": "Ancient",
    "shipType": "Solar Power",
    "name": "Convert",
    "totalLineCost": null,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": null,
    "powers": [
      {
        "subphase": "Charge Declaration",
        "text": "Generate an additional line next build phase."
      }
    ],
    "energyCost": {
      "red": 0,
      "green": 0,
      "blue": 1,
      "xBlue": false
    },
    "extraRules": "* Convert is the only way energy can be converted back into lines. Lines can be saved.",
    "stackCaption": "N/A",
    "colour": "N/A",
    "numberOfGraphics": 0
  },
  {
    "id": "SSIM",
    "species": "Ancient",
    "shipType": "Solar Power",
    "name": "Simulacrum",
    "totalLineCost": null,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": null,
    "powers": [
      {
        "subphase": "Charge Declaration",
        "text": "Make a copy of a basic enemy ship.\\nX = Number of lines in ship."
      }
    ],
    "energyCost": {
      "red": 0,
      "green": 0,
      "blue": 0,
      "xBlue": true
    },
    "extraRules": "Each ship may only be targeted ONCE per turn. Ships with charges are copied as they are at the START of this turn. Copied ships CAN be upgraded. A Cube-cast makes an extra copy of target ship. Cannot copy Cube.",
    "stackCaption": "N/A",
    "colour": "N/A",
    "numberOfGraphics": 0
  },
  {
    "id": "SSIP",
    "species": "Ancient",
    "shipType": "Solar Power",
    "name": "Siphon",
    "totalLineCost": null,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": null,
    "powers": [
      {
        "subphase": "Charge Declaration",
        "text": "Deal 1 damage for each Core you have.\\nHeal 1 for each Core you have."
      }
    ],
    "energyCost": {
      "red": 2,
      "green": 2,
      "blue": 0,
      "xBlue": false
    },
    "extraRules": "",
    "stackCaption": "N/A",
    "colour": "N/A",
    "numberOfGraphics": 0
  },
  {
    "id": "SVOR",
    "species": "Ancient",
    "shipType": "Solar Power",
    "name": "Vortex",
    "totalLineCost": null,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": null,
    "powers": [
      {
        "subphase": "Charge Declaration",
        "text": "Deal 2 damage for each TYPE of ship you have."
      }
    ],
    "energyCost": {
      "red": 2,
      "green": 2,
      "blue": 1,
      "xBlue": false
    },
    "extraRules": "",
    "stackCaption": "N/A",
    "colour": "N/A",
    "numberOfGraphics": 0
  },
  {
    "id": "SBLA",
    "species": "Ancient",
    "shipType": "Solar Power",
    "name": "Black Hole",
    "totalLineCost": null,
    "joiningLineCost": null,
    "componentShips": [],
    "charges": null,
    "powers": [
      {
        "subphase": "Charge Declaration",
        "text": "Destroy TWO of the opponent's basic ships.\\nDeal 4 damage."
      }
    ],
    "energyCost": {
      "red": 3,
      "green": 3,
      "blue": 3,
      "xBlue": false
    },
    "extraRules": "",
    "stackCaption": "N/A",
    "colour": "N/A",
    "numberOfGraphics": 0
  }
] as const;

/**
 * Version identifier for client-side ship definitions
 * Format: YYYY-MM-DDx (x = letter for multiple updates same day)
 * 
 * IMPORTANT: This version should match the server-side version when synced.
 * Server version is in: /supabase/functions/server/engine_shared/defs/ShipDefinitions.json.ts
 */
export const SHIP_DEFS_VERSION = '2026-01-16';

// ============================================================================
// TYPE INFERENCE HELPERS
// ============================================================================

export type ShipDefinitionJSON = typeof SHIP_DEFINITIONS_JSON[number];
export type ShipPowerJSON = ShipDefinitionJSON['powers'][number];
export type EnergyCostJSON = NonNullable<ShipDefinitionJSON['energyCost']>;

// ============================================================================
// DEV-ONLY VALIDATION
// ============================================================================

/**
 * Minimal schema validation for ship definitions.
 * 
 * WHY DEV-ONLY:
 * - These checks guard against authoring errors during development
 * - Production runtime doesn't need to re-validate static data
 * 
 * WHY PRESERVE LITERAL "\\n":
 * - Power text must remain as-authored from the JSON source
 * - The UI rendering layer handles escape sequence interpretation
 * - Prevents data corruption from auto-conversion
 * 
 * VALIDATION SCOPE (MINIMAL):
 * - Unique ship IDs (prevents duplicate definitions)
 * - No real newline characters in power text (must use literal "\\n")
 */

if (process.env.NODE_ENV !== 'production') {
  const errors: string[] = [];
  
  // ==========================================================================
  // UNIQUE SHIP IDs
  // ==========================================================================
  
  const seenIds = new Set<string>();
  const duplicateIds = new Set<string>();
  
  for (const ship of SHIP_DEFINITIONS_JSON) {
    if (seenIds.has(ship.id)) {
      duplicateIds.add(ship.id);
    }
    seenIds.add(ship.id);
  }
  
  if (duplicateIds.size > 0) {
    errors.push(
      `Duplicate ship IDs found: ${Array.from(duplicateIds).join(', ')}`
    );
  }
  
  // ==========================================================================
  // NO REAL NEWLINES IN POWER TEXT
  // ==========================================================================
  
  for (const ship of SHIP_DEFINITIONS_JSON) {
    for (const power of ship.powers) {
      // Check for ACTUAL newline characters (not the literal sequence)
      if (power.text.includes('\n')) {
        errors.push(
          `Ship "${ship.id}" power "${power.subphase}" contains real newline character. ` +
          `Must use literal "\\\\n" escape sequence instead.`
        );
      }
    }
  }
  
  // ==========================================================================
  // REPORT VALIDATION ERRORS
  // ==========================================================================
  
  if (errors.length > 0) {
    const errorReport = [
      '',
      '═══════════════════════════════════════════════════════════════',
      '  SHIP DEFINITIONS VALIDATION FAILED',
      '═══════════════════════════════════════════════════════════════',
      '',
      `Found ${errors.length} error(s):`,
      '',
      ...errors.map((err, i) => `${i + 1}. ${err}`),
      '',
      '═══════════════════════════════════════════════════════════════',
      ''
    ].join('\n');
    
    throw new Error(errorReport);
  }
  
  // Success message
  console.log(
    `✓ Ship definitions validated: ${SHIP_DEFINITIONS_JSON.length} ships, ` +
    `${SHIP_DEFINITIONS_JSON.reduce((sum, s) => sum + s.powers.length, 0)} powers`
  );
}