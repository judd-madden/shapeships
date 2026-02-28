# Build Kit Changelog

## Updates Applied

### Color Palette Addition
- **System Label: #DA41B9** - Added to definitive color list, used for all headings in Build Kit showcase

### Global Button Styling
- ✅ All buttons and clickable components now have `cursor-pointer` set
- ✅ Applies to: PrimaryButton, MenuButton, ReadyButton, ActionButton, ActionButtonSmall, LobbyRow, Tab, SecondaryNavItem, RadioButton, Checkbox

### Login Screens Button (PrimaryButton)
- ✅ Simplified to single instance with hover effect
- ✅ Replaced border outline hover with `scale-105` CSS transform
- ✅ Added `transition-transform` for smooth animation

### Login Screens Input Field (InputField)
- ✅ Fixed hover state: now displays Grey 50 (#888888) border
- ✅ Fixed focus state: now displays White (#FFFFFF) border
- ✅ Default state uses Grey 70 (#555555) border
- ✅ Error state uses Pastel Red (#FF8282) border with `!important` override

### Menu Screens Buttons (MenuButton)
- ✅ Replaced border outline hover with `scale-105` CSS transform
- ✅ Added `transition-transform` for smooth animation
- ✅ Selected state remains unchanged (white border outline)

### Lobby Row
- ✅ Clarified three states:
  - **Default**: Black background (#000000)
  - **Alternate**: Grey 90 background (#212121) - for zebra striping
  - **Selected-Own**: White background (#FFFFFF) - user's own game
- ✅ Hover for Default and Alternate: changes background to Grey 70 (#555555)
- ✅ No hover effect for Selected-Own state
- ✅ Text color updates: white for Default/Alternate, black for Selected-Own
- ✅ Variants text color: Grey 50 (#888888) for Default/Alternate, Grey 70 (#555555) for Selected-Own

### Game Screen - Ready Button (ReadyButton)
- ✅ Replaced border outline hover with `scale-105` CSS transform
- ✅ Added `transition-transform` for smooth animation
- ✅ Applied to both default and selected states

### Action Buttons (ActionButton & ActionButtonSmall)
- ✅ Ensured text is centered vertically using flexbox
- ✅ Renamed variants in showcase:
  - 'Selected - Yellow' → 'Selected (Yellow ship)'
  - 'Selected - Blue Ship Color' → 'Selected (Blue ship, white text)'
- ✅ Default state uses configurable background color (Grey 20 #D4D4D4 default)
- ✅ Added `textColor` prop ('black' | 'white') for legibility with different ship colors
- ✅ Fixed padding on Large version: consistent 3px white outline when selected
- ✅ Selected state shows 3px white border (p-[3px] wrapper)
- ✅ Inner button maintains 2px black border at all times

## Component Props Updates

### ActionButton
```tsx
interface ActionButtonProps {
  label: string;
  detail?: string;
  selected?: boolean;
  backgroundColor?: string;  // Default: '#D4D4D4'
  textColor?: 'black' | 'white';  // Default: 'black'
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}
```

### ActionButtonSmall
```tsx
interface ActionButtonSmallProps {
  label: string;
  selected?: boolean;
  backgroundColor?: string;  // Default: '#D4D4D4'
  textColor?: 'black' | 'white';  // Default: 'black'
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}
```

## Usage Examples

### Action Button with Ship Colors
```tsx
// Yellow ship (Pastel Yellow #FCFF81) - black text
<ActionButton 
  label="Action" 
  detail="(2/3)"
  selected 
  backgroundColor="#FCFF81" 
  textColor="black"
/>

// Blue ship (Blue #2555FF) - white text for legibility
<ActionButton 
  label="Action" 
  detail="(2/3)"
  selected 
  backgroundColor="#2555FF" 
  textColor="white"
/>

// Green ship (Pastel Green #9CFF84) - black text
<ActionButton 
  label="Action" 
  detail="(2/3)"
  selected 
  backgroundColor="#9CFF84" 
  textColor="black"
/>
```

### Input Field States
```tsx
// Default: Grey 70 border
<InputField value={input} onChange={setInput} />

// Hover: Grey 50 border (automatic)
// Focus: White border (automatic)

// Error: Pastel Red border
<InputField value={input} onChange={setInput} error />
```

### Lobby Row Striping
```tsx
{games.map((game, index) => (
  <LobbyRow
    key={game.id}
    {...game}
    alternate={index % 2 === 1}  // Zebra striping
    selected={game.creatorId === currentUserId}  // User's own game
  />
))}
```