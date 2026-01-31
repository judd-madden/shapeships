/**
 * PLAYER NAME UTILITIES
 * 
 * Player name resolution with priority order:
 * 1. props.playerName (if provided by dashboard launcher)
 * 2. localStorage stored name (key: ss_playerName)
 * 3. Generate random friendly name and store to localStorage
 */

const PLAYER_NAME_KEY = 'ss_playerName';

// Two-word random name generation (friendly style)
const ADJECTIVES = [
  'Swift', 'Brave', 'Clever', 'Bold', 'Wise', 'Calm', 'Noble', 'Fierce',
  'Bright', 'Quick', 'Strong', 'Silent', 'Wild', 'Keen', 'Sharp', 'Steady'
];

const FIRST_NAMES = [
  'Alex', 'Blake', 'Casey', 'Drew', 'Ellis', 'Finley', 'Gray', 'Harper',
  'Iris', 'Jordan', 'Kai', 'Logan', 'Morgan', 'Nico', 'Parker', 'Quinn'
];

function generateRandomName(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  return `${adjective} ${firstName}`;
}

export function getPlayerName(propsPlayerName: string): string {
  // Priority 1: props.playerName (if provided by dashboard launcher)
  if (propsPlayerName && propsPlayerName.trim() && propsPlayerName !== 'Guest') {
    return propsPlayerName;
  }
  
  // Priority 2: localStorage stored name
  const storedName = localStorage.getItem(PLAYER_NAME_KEY);
  if (storedName && storedName.trim()) {
    return storedName;
  }
  
  // Priority 3: Generate random friendly name
  const randomName = generateRandomName();
  
  // Store to localStorage for stability across refresh
  localStorage.setItem(PLAYER_NAME_KEY, randomName);
  console.log('[useGameSession] Generated random player name:', randomName);
  
  return randomName;
}
