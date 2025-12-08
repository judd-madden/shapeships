# Game Test Interface

## Overview
The Game Test Interface provides a simple, text-based interface for testing Shapeships game mechanics and multiplayer functionality. This is a development tool designed for testing game flow before implementing the full graphical interface.

## Features

### Basic Game Testing
- **Species Selection**: Choose from Human, Xenite, Centaur, Ancient
- **Ship Building**: Test ship construction with basic Human ships
- **Resource Management**: Track health, lines, joining lines, and energy
- **Turn-based Actions**: Basic phase management and turn progression
- **Multiplayer Support**: Real-time synchronization between players

### Available Human Ships (For Testing)
1. **Fighter** (1 line) - 1 health, 2 damage
2. **Defender** (1 line) - 2 health, 1 damage  
3. **Interceptor** (2 lines) - 1 health, 2 damage, First Strike
4. **Constructor** (3 lines) - 2 health, 0 damage, Can build ships

### Testing Actions
- **Roll Dice**: Simulate dice rolls for gaining lines
- **Build Ships**: Test ship construction mechanics
- **Set Ready**: Toggle player ready status
- **Phase Actions**: Test turn progression and phase management
- **Messages**: Basic chat functionality

## Usage

### Starting a Test Game
1. Go to Development Dashboard
2. Click "Game Test Interface"
3. The interface will create a test game automatically
4. Share the game URL with another player for multiplayer testing

### Testing Multiplayer
1. Create game in one browser tab/window
2. Copy the game URL from the interface
3. Open in another browser tab/window (or share with another user)
4. Both players can select species and test interactions

### Basic Test Flow
1. **Species Selection**: Both players select a species
2. **Resource Generation**: Use "Roll Dice" to gain lines
3. **Ship Building**: Build ships using available lines
4. **Ready Status**: Set ready when done with actions
5. **Phase Progression**: Use phase actions to advance game state

## Technical Details

### Game State Structure
```typescript
{
  gameId: string,
  players: [{
    id: string,
    name: string,
    faction: 'human' | 'xenite' | 'centaur' | 'ancient' | null,
    isReady: boolean,
    isActive: boolean,
    health: number,
    lines: number,
    joiningLines: number, // Centaur only
    energy: number        // Ancient only
  }],
  gameData: {
    ships: {
      [playerId]: Ship[]
    }
  },
  currentPhase: string,
  currentSubPhase: string,
  turnNumber: number,
  status: 'waiting' | 'active' | 'finished'
}
```

### Action Types
- `select_species` - Choose player species
- `build_ship` - Construct a ship
- `set_ready` - Toggle ready status
- `phase_action` - Game phase management
- `message` - Send chat message

## Development Notes

### Limitations (By Design)
- Text-only interface for rapid testing
- Simplified game logic (not full rules engine)
- Basic ship stats and costs
- No graphics or animations
- Manual phase progression

### Integration Points
- Uses the same multiplayer backend as full game
- Compatible with existing GameState types
- Tests core game mechanics before UI implementation
- Validates server-side action processing

### Next Steps
This interface validates:
1. ✅ Multiplayer connectivity and synchronization
2. ✅ Basic resource management
3. ✅ Ship building mechanics
4. ✅ Turn-based action processing
5. ✅ Real-time state updates

Future development will build the full graphical interface on top of this tested foundation.
