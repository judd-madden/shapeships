# Build Kit - UI Primitives

This directory contains reusable UI primitives for Shapeships, designed to match the Build Kit Figma frame exactly.

## Design Principles

- **Pure Presentational**: No business logic, routing, or backend calls
- **Exact Color Compliance**: Uses only colors from the definitive Shapeships palette
- **State from Parent**: Components are controlled - state comes from props
- **Composable**: Designed to be composed into Login, Menu, and Game screens

## Color Palette Reference

```
Black:          #000000
White:          #FFFFFF
Grey 90:        #212121
Grey 70:        #555555
Grey 50:        #888888
Grey 20:        #D4D4D4
Pastel Green:   #9CFF84
Pastel Red:     #FF8282
Pastel Purple:  #CD8CFF
Green:          #00BD13
Pastel Yellow:  #FCFF81
Blue:           #2555FF
```

## Components

### Buttons (`/buttons/`)

#### PrimaryButton
- **Used on**: Login screens
- **States**: Default, Hover
- **Props**: `onClick`, `disabled`, `className`, `children`

```tsx
<PrimaryButton onClick={handleClick}>CREATE ACCOUNT</PrimaryButton>
```

#### MenuButton
- **Used on**: Menu screens
- **Variants**: `private` (purple), `public` (green), `join` (grey/white)
- **States**: Default, Hover, Selected
- **Props**: `variant`, `selected`, `disabled`, `onClick`, `className`, `children`

```tsx
<MenuButton variant="private" selected={isPrivate}>CREATE PRIVATE GAME</MenuButton>
<MenuButton variant="public">CREATE LOBBY GAME</MenuButton>
<MenuButton variant="join">JOIN LOBBY GAME</MenuButton>
```

#### ReadyButton
- **Used on**: Game screens
- **States**: Default, Hover, Selected, SelectedHover
- **Features**: Tick icon when selected, optional conditional note
- **Props**: `selected`, `onClick`, `disabled`, `className`, `note`

```tsx
<ReadyButton selected={isReady} note="Waiting for opponent" />
```

#### ActionButton (Large)
- **Used on**: Game screens for ship actions
- **States**: Default, Selected
- **Features**: Configurable selected color (based on ship color)
- **Props**: `label`, `detail`, `selected`, `selectedColor`, `onClick`, `disabled`, `className`

```tsx
<ActionButton 
  label="Action" 
  detail="(charge count)" 
  selected={isSelected}
  selectedColor="#2555FF" 
/>
```

#### ActionButtonSmall
- **Used on**: Game screens for secondary actions
- **States**: Default, Selected
- **Features**: Configurable selected color (based on ship color)
- **Props**: `label`, `selected`, `selectedColor`, `onClick`, `disabled`, `className`

```tsx
<ActionButtonSmall 
  label="Hold Charge" 
  selected={isHolding}
  selectedColor="#2555FF" 
/>
```

### Inputs (`/inputs/`)

#### InputField
- **Used on**: Login screens
- **States**: Default, Hover, Focus, Error
- **Props**: `value`, `onChange`, `placeholder`, `error`, `disabled`, `className`, `type`

```tsx
<InputField 
  value={username} 
  onChange={setUsername} 
  placeholder="Username"
  error={hasError}
  type="text"
/>
```

### Lobby (`/lobby/`)

#### LobbyRow
- **Used on**: Menu screens to display available games
- **Variants**: Default (black), Alternate (grey 90) - for row striping
- **States**: Default, Hover, Selected (own game)
- **Props**: `playerName`, `gameMode`, `matchType`, `timeControl`, `duration`, `variants`, `alternate`, `selected`, `onClick`, `className`

```tsx
<LobbyRow
  playerName="Guest 12"
  gameMode="Standard"
  matchType="X v Any"
  timeControl="10m + 30s"
  duration="45m"
  variants="Epic Health, Accelerated Game, No Destruction"
  alternate={index % 2 === 1}
  selected={isOwnGame}
  onClick={handleJoinGame}
/>
```

### Controls (`/controls/`)

#### RadioButton
- **States**: Default, Selected
- **Features**: Pastel Green accent when selected
- **Props**: `selected`, `onClick`, `disabled`, `className`

```tsx
<RadioButton 
  selected={selectedOption === 'option1'} 
  onClick={() => setSelectedOption('option1')} 
/>
```

#### Checkbox
- **States**: Default, Selected
- **Features**: White checkmark when selected
- **Props**: `checked`, `onChange`, `disabled`, `className`

```tsx
<Checkbox 
  checked={isChecked} 
  onChange={setIsChecked} 
/>
```

### Navigation (`/navigation/`)

#### Tab
- **States**: Default, Hover, Selected
- **Features**: Underline on hover (non-selected), grey 70 background when selected
- **Props**: `label`, `selected`, `onClick`, `disabled`, `className`

```tsx
<Tab 
  label="Build Phase" 
  selected={currentTab === 'build'} 
  onClick={() => setCurrentTab('build')} 
/>
```

#### SecondaryNavItem
- **States**: Default, Hover, Selected
- **Features**: Underline on hover (non-selected), white background when selected
- **Props**: `label`, `selected`, `onClick`, `disabled`, `className`

```tsx
<SecondaryNavItem 
  label="Ships" 
  selected={currentNav === 'ships'} 
  onClick={() => setCurrentNav('ships')} 
/>
```

### Icons (`/icons/`)

#### ChevronDown
- **Features**: Configurable color
- **Props**: `className`, `color` (default: "white")

```tsx
<ChevronDown color="white" />
```

#### BuildIcon
- **Features**: Configurable color
- **Props**: `className`, `color` (default: "#D5D5D5")

```tsx
<BuildIcon color="#9CFF84" />
```

#### BattleIcon
- **Features**: Configurable color
- **Props**: `className`, `color` (default: "#D5D5D5")

```tsx
<BattleIcon color="#FF8282" />
```

### Dice (`/dice/`)

#### Dice
- **Features**: Displays dice faces 1-6 using imported PNG images
- **Props**: `value` (1-6), `className`

```tsx
<Dice value={diceRoll} />
```

## Usage Example

```tsx
import { 
  PrimaryButton, 
  MenuButton, 
  InputField,
  LobbyRow 
} from './components/ui/primitives';

function LoginScreen() {
  const [username, setUsername] = useState('');
  
  return (
    <div>
      <InputField 
        value={username} 
        onChange={setUsername}
        placeholder="Enter username"
      />
      <PrimaryButton onClick={handleLogin}>
        CREATE ACCOUNT
      </PrimaryButton>
    </div>
  );
}

function MenuScreen() {
  const [gameType, setGameType] = useState<'private' | 'public' | null>(null);
  
  return (
    <div>
      <MenuButton 
        variant="private" 
        selected={gameType === 'private'}
        onClick={() => setGameType('private')}
      >
        CREATE PRIVATE GAME
      </MenuButton>
      <MenuButton 
        variant="public" 
        selected={gameType === 'public'}
        onClick={() => setGameType('public')}
      >
        CREATE LOBBY GAME
      </MenuButton>
    </div>
  );
}
```

## Viewing the Build Kit

Access the Build Kit showcase via the Development Dashboard:
1. Open the app
2. Click "Build Kit" in the Development Tools section
3. View all primitives with their various states and variants

## Important Notes

- ❌ DO NOT add routing to these components
- ❌ DO NOT add backend calls
- ❌ DO NOT add game engine logic
- ❌ DO NOT modify colors outside the definitive palette
- ✅ DO accept visual state via props
- ✅ DO maintain exact pixel specifications from Figma
- ✅ DO use Roboto font family with proper font-variation-settings
