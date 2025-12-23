# Battle Log Compression & Export Planning

**Status:** Planning document - NOT YET IMPLEMENTED  
**Priority:** Post-core game build  
**Estimated Implementation:** 2-3 hours  

---

## 🎯 Goals

1. **Reduce bandwidth** - Compress battle log entries from ~180 bytes to ~15 bytes (12× reduction)
2. **Enable exports** - Save complete game history in shareable format (like chess PGN files)
3. **Maintain readability** - Keep compact format human-readable for debugging
4. **Rich display** - Expand compact notation to rich UI elements on client side

---

## 📊 Current vs. Planned Format

### Current Format (Verbose)
```typescript
{
  timestamp: "2025-12-15T10:30:45.123Z",
  playerId: "user_abc123xyz",
  playerName: "Alice",
  action: "build_ship",
  shipType: "wedge",
  species: "human",
  cost: 3,
  turn: 5,
  phase: "Build Phase",
  subphase: 2,
  context: { linesRemaining: 7, totalShips: 4 }
}
```
**Size:** ~180 bytes per entry  
**Problem:** 100-300 entries per game = 18-54 KB in every poll response

---

### Planned Format (Compact Notation)
```typescript
"5.2:p1:BS:hw:3"
```
**Size:** ~15 bytes per entry  
**Structure:** `Turn.Subphase:Player:Action:...Args`

**Same data, 12× smaller!**

---

## 🔤 Notation Specification

### Basic Structure
```
[Turn].[Subphase]:[Player]:[ActionCode]:[...Arguments]
```

### Action Codes

| Code | Action | Arguments | Example |
|------|--------|-----------|---------|
| `RD` | Roll Dice | `result` | `1.1:p1:RD:5` |
| `BS` | Build Ship | `shipCode`, `cost` | `1.2:p1:BS:hw:3` |
| `AT` | Attack | `shipId`, `targetPlayer`, `damage` | `1.8:p1:AT:s1:p2:12` |
| `HL` | Heal | `shipId`, `targetPlayer`, `healing` | `1.9:p1:HL:s2:p1:4` |
| `AC` | Activate Power | `shipId`, `powerType` | `1.5:p1:AC:s3:charge` |
| `SK` | Skip Phase | *(none)* | `1.6:p1:SK` |
| `RDY` | Declare Ready | *(none)* | `1.7:p1:RDY` |
| `PH` | Phase Auto-Advance | *(none)* | `1.3:PH` |
| `DMG` | Damage Dealt | `amount`, `source` | `1.11:p2:DMG:15:auto` |
| `WIN` | Victory | *(none)* | `5.H:p1:WIN` |
| `MSG` | Chat Message | `text` | `2.4:p1:MSG:gg` |

### Ship Codes (Three-Letter IDs from Ship Registry)

#### Human Ships
| Code | Ship Name |
|------|-----------|
| `DEF` | Defender |
| `FIG` | Fighter |
| `COM` | Commander |
| `INT` | Interceptor |
| `ORB` | Orbital |
| `CAR` | Carrier |
| `STA` | Starship |
| `FRI` | Frigate |
| `TAC` | Tactical Cruiser |
| `GUA` | Guardian |
| `SCI` | Science Vessel |
| `BAT` | Battle Cruiser |
| `EAR` | Earth Ship |
| `DRE` | Dreadnought |
| `LEV` | Leviathan |

#### Xenite Ships
| Code | Ship Name |
|------|-----------|
| `XEN` | Xenite |
| `ANT` | Antlion |
| `MAN` | Mantis |
| `EVO` | Evolver |
| `OXI` | Oxite |
| `AST` | Asterite |
| `HEL` | Hell Hornet |
| `BUG` | Bug Breeder |
| `ZEN` | Zenith |
| `DSW` | Defense Swarm |
| `AAR` | Antlion Array |
| `OXF` | Oxite Face |
| `ASF` | Asterite Face |
| `SAC` | Sacrificial Pool |
| `QUE` | Queen |
| `CHR` | Chronoswarm |
| `HVE` | Hive |

#### Centaur Ships
| Code | Ship Name |
|------|-----------|
| `FEA` | Ship of Fear |
| `ANG` | Ship of Anger |
| `EQU` | Ship of Equality |
| `WIS` | Ship of Wisdom |
| `VIG` | Ship of Vigor |
| `FAM` | Ship of Family |
| `LEG` | Ship of Legacy |
| `TER` | Ark of Terror |
| `FUR` | Ark of Fury |
| `KNO` | Ark of Knowledge |
| `ENT` | Ark of Entropy |
| `RED` | Ark of Redemption |
| `POW` | Ark of Power |
| `DES` | Ark of Destruction |
| `DOM` | Ark of Domination |

#### Ancient Ships
| Code | Ship Name |
|------|-----------|
| `SPI` | Spiral |
| `CUB` | Cube |
| `QUA` | Quantum Mystic |
| `MER` | Mercury Core |
| `PLU` | Pluto Core |
| `URA` | Uranus Core |
| `SOL` | Solar Grid |

#### Ancient Solar Powers
| Code | Solar Power Name |
|------|------------------|
| `SAST` | Asteroid |
| `SSUP` | Supernova |
| `SLIF` | Life |
| `SSTA` | Star Birth |
| `SCON` | Convert |
| `SSIM` | Simulacrum |
| `SSIP` | Siphon |
| `SVOR` | Vortex |
| `SBLA` | Black Hole |

### Player Codes
- `p1` - Player 1
- `p2` - Player 2
- `PH` - System/Automatic (for phase advances)

### Special Phase Codes
- `H` - Health Resolution phase (end of turn)
- Numbers `1-13` - Standard subphases

---

## 📝 Example Game Notation

```
1.1:p1:RD:5
1.1:p2:RD:4
1.2:p1:BS:DEF:2
1.2:p2:BS:XEN:2
1.2:p1:BS:FIG:3
1.3:PH
1.4:p1:SK
1.4:p2:SK
1.5:PH
1.6:p1:SK
1.6:p2:SK
1.7:PH
1.8:p1:RDY
1.8:p2:RDY
1.8:p1:AT:s1:p2:1
1.8:p2:AT:s3:p1:1
1.9:p1:SK
1.9:p2:SK
1.10:PH
1.11:PH
1.12:PH
1.13:PH
1.H:p1:DMG:1
1.H:p2:DMG:1
2.1:p1:RD:6
...
```

**Human-readable breakdown:**
- Turn 1, Subphase 1: Both players rolled dice (P1=5, P2=4)
- Turn 1, Subphase 2: P1 built Defender + Fighter, P2 built Xenite
- Turn 1, Subphase 3-7: Auto-advanced (no relevant ships)
- Turn 1, Subphase 8: Both ready, attacks executed (1 damage each)
- Turn 1, Health Resolution: Both players took 1 damage

---

## 🏗️ Implementation Architecture

### 1. Storage Layer (Server)

**In `/supabase/functions/server/index.tsx`:**

```typescript
// Store compact notation array
type CompactBattleLog = string[];

interface GameState {
  // ... existing fields
  battleLog: CompactBattleLog;  // Changed from verbose objects
}

// When logging action:
function logAction(gameState: GameState, action: CompactLogEntry) {
  gameState.battleLog.push(action);
}

// Example usage:
logAction(gameState, `${turn}.${subphase}:p1:BS:DEF:2`);
```

---

### 2. Expansion Layer (Client)

**Create `/game/utils/battleLogExpander.tsx`:**

```typescript
import { GameState, Player, Ship } from '../types/GameTypes';
import { SHIP_REGISTRY } from '../data/ShipDefinitions';

export interface RichLogEntry {
  type: 'build' | 'attack' | 'heal' | 'activate' | 'system' | 'chat';
  turn: number;
  subphase: number;
  player?: Player;
  displayText: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export function expandLogEntry(
  compact: string, 
  gameContext: GameState
): RichLogEntry {
  const parts = compact.split(':');
  const [turnPhase, player, action, ...args] = parts;
  const [turn, subphase] = turnPhase.split('.');
  
  const turnNum = parseInt(turn);
  const subphaseNum = subphase === 'H' ? 0 : parseInt(subphase);
  const playerData = gameContext.players.find(p => p.id === player);
  
  switch (action) {
    case 'RD': // Roll Dice
      const [rollResult] = args;
      return {
        type: 'system',
        turn: turnNum,
        subphase: subphaseNum,
        player: playerData,
        displayText: `${playerData?.name || player} rolled ${rollResult}`,
      };
    
    case 'BS': // Build Ship
      const [shipCode, cost] = args;
      const shipData = SHIP_REGISTRY[shipCode];
      return {
        type: 'build',
        turn: turnNum,
        subphase: subphaseNum,
        player: playerData,
        displayText: `${playerData?.name || player} built ${shipData.name} for ${cost} lines`,
        metadata: { shipCode, cost: parseInt(cost) },
      };
    
    case 'AT': // Attack
      const [shipId, targetPlayer, damage] = args;
      const targetData = gameContext.players.find(p => p.id === targetPlayer);
      return {
        type: 'attack',
        turn: turnNum,
        subphase: subphaseNum,
        player: playerData,
        displayText: `${playerData?.name || player}'s ship dealt ${damage} damage to ${targetData?.name || targetPlayer}`,
        metadata: { shipId, damage: parseInt(damage) },
      };
    
    case 'PH': // Phase Auto-Advance
      return {
        type: 'system',
        turn: turnNum,
        subphase: subphaseNum,
        displayText: `Phase ${subphaseNum} completed automatically`,
      };
    
    case 'MSG': // Chat Message
      const message = args.join(':'); // Rejoin in case message had colons
      return {
        type: 'chat',
        turn: turnNum,
        subphase: subphaseNum,
        player: playerData,
        displayText: message,
      };
    
    // Add other cases as needed...
    
    default:
      return {
        type: 'system',
        turn: turnNum,
        subphase: subphaseNum,
        displayText: compact, // Fallback: show raw notation
      };
  }
}

export function expandBattleLog(
  compactLog: CompactBattleLog,
  gameContext: GameState
): RichLogEntry[] {
  return compactLog.map(entry => expandLogEntry(entry, gameContext));
}
```

---

### 3. Display Component Update

**Update `/game/display/BattleLog.tsx`:**

```typescript
import { expandBattleLog } from '../utils/battleLogExpander';

export function BattleLog({ gameState }: { gameState: GameState }) {
  const richEntries = expandBattleLog(gameState.battleLog, gameState);
  
  return (
    <div className="battle-log-container">
      {richEntries.map((entry, i) => (
        <LogEntry key={i} entry={entry} />
      ))}
    </div>
  );
}

function LogEntry({ entry }: { entry: RichLogEntry }) {
  const typeColors = {
    build: 'text-shapeships-green',
    attack: 'text-shapeships-red',
    heal: 'text-shapeships-blue',
    system: 'text-shapeships-grey-50',
    chat: 'text-shapeships-white',
  };
  
  return (
    <div className={`log-entry ${typeColors[entry.type]}`}>
      <span className="turn-indicator">T{entry.turn}.{entry.subphase}</span>
      <span className="log-text">{entry.displayText}</span>
    </div>
  );
}
```

---

## 📤 Export System

### Game Archive Format (.shps file)

```
[Shapeships Game v1.0]
[Date "2025-12-15T10:30:00Z"]
[Player1 "Alice" "user_abc123"]
[Player2 "Bob" "user_xyz789"]
[Result "1-0"]
[FinalHealth "P1:100" "P2:0"]
[Duration "1234"]

1.1:p1:RD:5
1.1:p2:RD:4
1.2:p1:BS:DEF:2
1.2:p2:BS:XEN:2
...
20.H:p2:DMG:100
20.H:p1:WIN
```

### Export Implementation

**Create `/game/utils/gameExporter.tsx`:**

```typescript
export function exportGameToPGN(gameState: GameState): string {
  const metadata = [
    `[Shapeships Game v1.0]`,
    `[Date "${new Date().toISOString()}"]`,
    `[Player1 "${gameState.players[0].name}" "${gameState.players[0].id}"]`,
    `[Player2 "${gameState.players[1].name}" "${gameState.players[1].id}"]`,
    `[Result "${gameState.winner === 'p1' ? '1-0' : gameState.winner === 'p2' ? '0-1' : '1/2-1/2'}"]`,
    `[FinalHealth "P1:${gameState.players[0].health}" "P2:${gameState.players[1].health}"]`,
    `[Duration "${gameState.totalGameTime || 0}"]`,
  ].join('\n');
  
  const moves = gameState.battleLog.join('\n');
  
  return `${metadata}\n\n${moves}`;
}

export function downloadGameFile(gameState: GameState) {
  const content = exportGameToPGN(gameState);
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `shapeships-${gameState.gameId}-${Date.now()}.shps`;
  a.click();
  
  URL.revokeObjectURL(url);
}
```

### Archive to Supabase Storage

```typescript
// At game end, archive full log
async function archiveGame(gameId: string, gameState: GameState) {
  const pgn = exportGameToPGN(gameState);
  
  await supabase.storage
    .from('make-825e19ab-game-archives')
    .upload(`${gameId}.shps`, pgn, {
      contentType: 'text/plain',
      upsert: false,
    });
}
```

---

## 📋 Implementation Phases

### Phase 1: Define Notation System ✅
**(Completed in this document)**
- [x] Design compact format
- [x] Document all action codes
- [x] Document all ship codes
- [x] Create examples

### Phase 2: Server-Side Storage
**Estimated Time:** 30 minutes

**Tasks:**
- [ ] Update GameState type to use `CompactBattleLog`
- [ ] Modify action logging to generate compact strings
- [ ] Test that compact logs are stored correctly
- [ ] Keep verbose format in parallel (for safety)

### Phase 3: Client-Side Expansion
**Estimated Time:** 1 hour

**Tasks:**
- [ ] Create `battleLogExpander.tsx` utility
- [ ] Implement `expandLogEntry()` for all action types
- [ ] Update BattleLog component to use expansion
- [ ] Test that display matches old verbose version
- [ ] Add unit tests for edge cases

### Phase 4: Export System
**Estimated Time:** 30 minutes

**Tasks:**
- [ ] Create `gameExporter.tsx` utility
- [ ] Add "Export Game" button to UI
- [ ] Implement `.shps` file download
- [ ] Add Supabase Storage archival on game end
- [ ] Test export with complete game

### Phase 5: Cleanup & Optimization
**Estimated Time:** 30 minutes

**Tasks:**
- [ ] Remove old verbose logging code
- [ ] Validate bandwidth improvements (measure before/after)
- [ ] Add compression if needed (gzip middleware)
- [ ] Update documentation

---

## 🎯 Success Metrics

**Before Implementation:**
- Battle log size: ~180 bytes/entry × 200 entries = **36 KB per game**
- Poll payload: ~40-50 KB every 5 seconds

**After Implementation:**
- Battle log size: ~15 bytes/entry × 200 entries = **3 KB per game**
- Poll payload: ~7-17 KB every 5 seconds
- **Bandwidth reduction: ~67% for typical game state**

**Export Capabilities:**
- Full game exportable as 2-5 KB text file
- Shareable via Discord, email, forums
- Importable for replay analysis
- Archivable for player match history

---

## ⚠️ When to Implement

**DO NOT implement until:**
- ✅ Core 13-phase system is complete
- ✅ All ship powers are implemented
- ✅ Multiplayer synchronization is stable
- ✅ You've played at least 3 full test games
- ✅ You know all action types that exist

**Implement when:**
- Approaching 300-400 games/month (bandwidth concerns)
- Ready to add game history/replay features
- Want to enable community sharing of games
- Moving toward production release

**Priority Level:** Medium  
**Dependencies:** Core game loop, all ship powers defined  
**Risk:** Low (pure optimization, doesn't change gameplay)

---

## 🔗 Related Documents

- `/guidelines/Guidelines.md` - Main development guidelines (see Performance & Infrastructure section)
- `/game/types/ActionTypes.tsx` - Action type definitions
- `/game/data/ShipDefinitions.tsx` - Ship registry and codes

---

**Last Updated:** 2025-12-15  
**Status:** Planning complete, awaiting implementation  
**Estimated Total Implementation Time:** 2-3 hours