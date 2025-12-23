# Shapeships Development Guidelines

## 🎯 Project Philosophy

**Minimalist Approach:**
- Clean, focused implementation without unnecessary complexity
- Step-by-step development with comprehensive testing at each stage
- No assumptions about colors, styles, or content - everything explicitly specified
- Strict separation of concerns between game logic and display components

## 🏗️ Architecture Rules

**Game Engine Guidelines:**
- Pure functions for all game logic - no React dependencies in engine files
- Complete separation between logic (`/game/engine/`) and display (`/game/display/`)
- All game state changes must go through the `GameEngine` class
- TypeScript interfaces must be comprehensive and well-documented
- Rules implementation goes in `RulesEngine.tsx` - never mixed with display code

**Component Organization:**
- Game logic components in `/game/` directory
- UI components in `/components/` directory  
- Faction-specific graphics in `/graphics/{faction}/assets.tsx`
- Helper functions and utilities in separate files
- Keep file sizes small and focused on single responsibilities

## 🎨 Design System

**Layout Guidelines:**
- Only use absolute positioning when necessary
- Opt for responsive layouts using flexbox and grid by default
- Maintain consistent spacing using Tailwind spacing tokens
- Mobile-first responsive design approach

**Typography & Colors:**
- Use Roboto font family (already configured in globals.css)
- Base font size: 14px (configured in CSS variables)
- For player-facing screens: Use Shapeships color palette (`--shapeships-*`)
- For development tools: Use standard Tailwind colors
- Never override font-size, font-weight, or line-height classes unless explicitly requested

**Component Styling:**
- Shapeships colors: `text-shapeships-white`, `bg-shapeships-grey-90`, etc.
- Some components have built-in styling - explicitly override when needed
- Use CSS variables for consistent color application
- Maintain the established visual hierarchy

## 🔧 Code Quality

**General Rules:**
- Refactor code as you go to keep it clean and maintainable
- Use TypeScript strictly - no `any` types
- Comprehensive error handling, especially for Supabase calls
- Detailed console logging for debugging multiplayer interactions
- Comment complex game logic and state transitions

**File Structure:**
- Keep related functionality grouped in logical directories
- Use descriptive file names that indicate purpose
- Export components and functions with clear naming conventions
- Maintain the established folder structure

## 🎮 Game Development Specific

**Graphics System:**
- All images must use the modular asset system in `/graphics/`
- Import graphics through the assets.tsx files, never direct paths
- Use ImageWithFallback component for new images (not for Figma imports)
- Faction graphics are organized by folder: global, human, xenite, centaur, ancient

**Graphics Hosting Architecture:**

*Decision: Individual SVGs hosted within app as React components*

**Implementation:**
- Ship graphics stored as React components in `/graphics/{faction}/assets.tsx`
- SVG code embedded directly in TypeScript files (not external files)
- Graphics bundled with application (zero external HTTP requests)
- Ships may change in opacity or scale - no complex effects needed

**Why this approach:**
- ✅ **Zero bundle bloat**: Only ship exactly what's needed (~40 KB for all ships)
- ✅ **Instant loading**: Bundled with app, no network requests for graphics
- ✅ **Always available**: No external hosting dependency or failure points
- ✅ **Version control**: Graphics tracked in Git alongside code
- ✅ **Simple for geometry**: Ship graphics are basic geometric shapes (triangles, squares, etc.)
- ✅ **Philosophy alignment**: Matches "graphics stored within app" architecture requirement

**Why NOT Figma library import:**
- ❌ Bundle bloat: Would ship 90% unused graphics
- ❌ Overkill: Don't need 500+ icons for ~40 geometric ship shapes
- ❌ External dependency: Violates "within app" principle

**Why NOT external hosting:**
- ❌ Network dependency: Game fails if external host is down
- ❌ Performance hit: 40+ HTTP requests per game load (1-3 second delay)
- ❌ Bandwidth costs: Ongoing hosting costs and usage tracking
- ❌ Philosophy violation: Graphics must be stored within app

**Graphics creation workflow:**
1. Design ship as geometric SVG (triangle, square, pentagon, etc.)
2. Create React component in appropriate faction's `assets.tsx`
3. Export component for use in game displays
4. Reference in ship definitions

**Example structure:**
```typescript
// In /graphics/human/assets.tsx
export const WedgeShip: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="93" 
    height="51" 
    viewBox="0 0 93 51" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <polygon points="46.5,5 88,46 5,46" fill="black" stroke="#9CFF84" strokeWidth="3" />
  </svg>
);

// Usage with arbitrary pixel values
<WedgeShip className="w-[93px] h-[51px]" />
<WedgeShip className="w-[186px] h-[102px]" /> // 2x scale
<WedgeShip className="w-[93px] h-[51px] opacity-50" /> // with transparency
```

**Styling approach:**
- SVGs accept className prop for Tailwind utilities (opacity, scale, etc.)
- Use arbitrary pixel values for precise sizing: `className="w-[52px] h-[32px]"`
- Arbitrary values allow exact dimensions without Tailwind spacing constraints
- No need to design graphics with dimensions divisible by 4
- No complex effects, filters, or animations required
- Ship appearance changes only through opacity/scale transformations

**Multiplayer Integration:**
- Always test game logic changes with the multiplayer system
- Use the useGameState hook for game state management in React components
- Validate actions locally before sending to server
- Handle network errors gracefully with user feedback

**Testing Requirements:**
- Use the development dashboard for comprehensive testing
- Test both single-player logic and multiplayer synchronization
- Validate graphics loading across all test scenarios
- Ensure backward compatibility when adding new features

## 🚀 Deployment Standards

**Supabase Integration:**
- Edge functions must be self-contained (no local file imports)
- Comprehensive error handling and logging in server functions
- Use environment variables for all external API keys
- Test deployment status before releasing new features

**Version Control:**
- Use descriptive commit messages with emoji prefixes
- Branch strategy: main (stable), develop (integration), feature branches
- Document breaking changes and migration requirements
- Tag major versions with clear release notes

## 🔌 Performance & Infrastructure

### Polling Architecture

**What is Polling?**
- Client (frontend) repeatedly requests game state from server at regular intervals
- Alternative to WebSockets/SSE (real-time push notifications)
- Simpler to implement and works reliably across all network conditions
- Trade-off: Slight delay in seeing updates vs. implementation complexity

**Current Implementation:**
- Polling interval: **5 seconds** (configurable in `/game/hooks/useGameState.tsx`)
- Intelligent polling: Faster during active phases, slower during waiting periods
- Action-triggered refresh: Immediate update after taking actions (no wait for next poll)
- Request format: `GET /game-state/:gameId` with Authorization header

**Why 5 Seconds?**
- Turn-based gameplay: Players need time to think, 5s delay feels nearly instant
- Battery efficient: Lower frequency = less mobile battery drain
- Network efficient: Reduces mobile data usage
- User experience: Appropriate for non-real-time gameplay
- Server friendly: Allows more concurrent games without overload

### Server Capacity Estimates

**Current Setup (5-second polling, Supabase Free Tier):**

**Per Game Resource Usage:**
- 2 players polling every 5 seconds = 24 requests/minute
- Average game duration: 20 minutes
- Total requests per game: 480 requests
- Bandwidth per game: ~4-5 MB (uncompressed)

**Concurrent Game Capacity:**
- **Safe range**: 1-10 simultaneous games
- **Moderate load**: 10-30 simultaneous games
- **At risk**: 30+ simultaneous games (may hit rate limits)

**Monthly Capacity (2 GB free tier bandwidth):**
- **Current**: ~425 games/month (uncompressed)
- **With compression**: ~1,700 games/month (4× increase)
- **With optimizations**: ~850 games/month (2× increase, simple implementation)

**Bottlenecks to Watch:**
- Supabase Edge Function concurrent request limits (50-100/region)
- Database connection pool (100+ connections available)
- Bandwidth limits (2 GB/month on free tier)
- Response time degradation (acceptable < 2s, problematic > 3s)

### Bandwidth Optimization Options

**Quick Win #1: Limit Actions Log (Recommended First)**
- **Implementation**: Only send last 50 actions in game state response
- **Complexity**: 5 minutes to implement
- **Bandwidth savings**: 50% reduction in late-game states (20 KB → 10 KB)
- **Capacity increase**: 425 → 850 games/month (2× increase)
- **Trade-offs**: None (old actions can be archived if needed)
- **When to implement**: Before reaching 300 games/month

```typescript
// In server/index.tsx
if (gameData.actions && gameData.actions.length > 50) {
  gameData = { ...gameData, actions: gameData.actions.slice(-50) };
}
```

**Quick Win #2: Adaptive Polling Rate**
- **Implementation**: Adjust polling speed based on game phase
- **Complexity**: 30 minutes to implement
- **Bandwidth savings**: 20-30% reduction
- **Trade-offs**: Slight delay in non-critical phases
- **When to implement**: When approaching 20 concurrent games

**Quick Win #3: JSON Compression (Production-Ready)**
- **Implementation**: Add gzip compression middleware to Edge Function
- **Complexity**: 1-2 hours to implement + testing
- **Bandwidth savings**: 75-80% reduction (10 KB → 2.5 KB typical)
- **Capacity increase**: 425 → 1,700 games/month (4× increase)
- **Trade-offs**: 
  - Harder to debug (binary responses in DevTools)
  - +10-50ms server processing time
  - More complex error handling
- **When to implement**: 
  - Approaching 500 games/month
  - Moving to production deployment
  - Need to support 50+ concurrent games

**Advanced: WebSockets / Supabase Realtime**
- **Implementation**: Subscribe to database changes instead of polling
- **Complexity**: 4-6 hours to refactor + testing
- **Bandwidth savings**: 90%+ reduction
- **Capacity increase**: Supports 1000+ concurrent games
- **Trade-offs**:
  - Significantly more complex
  - Requires reconnection logic
  - Different debugging approach
- **When to implement**:
  - Production app with 100+ daily active games
  - Need sub-second response times
  - Budget for paid Supabase tier

### Performance Monitoring

**Warning Signs (Check Regularly):**
- [ ] Average response time > 2 seconds
- [ ] Database connection errors in logs
- [ ] Edge Function timeout errors (10s limit)
- [ ] Supabase bandwidth warnings
- [ ] Player complaints about lag

**Recommended Monitoring:**
- Log response times in browser console during development
- Check Supabase dashboard for bandwidth usage weekly
- Test with multiple browser tabs to simulate concurrent players
- Monitor Edge Function execution time in Supabase logs

**Scaling Checklist:**
- [ ] Under 300 games/month: Current setup is fine
- [ ] 300-500 games/month: Implement actions log limiting
- [ ] 500-1000 games/month: Add JSON compression
- [ ] 1000+ games/month: Consider WebSockets + paid tier

### Current Status: Prototype-Optimized

**Current priorities:**
- ✅ Simple, debuggable architecture
- ✅ Easy to iterate and test
- ✅ Supports development workflow
- ⏸️ Production scalability (defer until needed)

**Do NOT optimize prematurely:**
- Keep 5-second polling until reaching capacity limits
- Maintain readable JSON responses for debugging
- Focus on gameplay features over infrastructure scaling

## 📋 Development Workflow

**Before Adding Features:**
1. Test current system status using development dashboard
2. Validate multiplayer endpoints are working
3. Check graphics system is loading properly
4. Ensure game engine framework is ready

**When Implementing Rules:**
1. Implement logic in `RulesEngine.tsx` first
2. Create comprehensive TypeScript interfaces
3. Test with simplified UI before adding graphics
4. Validate with multiplayer system
5. Add visual polish last

**Quality Checklist:**
- [ ] Code follows separation of concerns
- [ ] TypeScript interfaces are complete
- [ ] Error handling is comprehensive
- [ ] Multiplayer functionality tested
- [ ] Graphics system validated
- [ ] Development dashboard shows all green status

## 🎯 Current Development Priorities

**Status: Based on game board design analysis (referenced against full Figma file)**

### ✅ Foundation Complete
Our game engine, multiplayer system, and data architecture fully support the target game design:
- **Updated Turn System**: Simplified state-driven model with 2 interactive phases (Build, Battle) + End of Turn Resolution
- Phase management: Build Phase (6 steps), Battle Phase (2 steps), End of Turn Resolution (automatic)
- **Core Invariant**: All damage and healing resolve together at End of Turn Resolution
- Health only changes at end of turn; players can only lose at end of turn
- "Upon Completion" replaced with "Once Only Automatic" effects
- Species-based ship organization (4 species with ship rosters)
- Ship power framework (damage, healing, scaling effects)
- Multiplayer synchronization with ready states
- Lines and dice roll system
- Health tracking and victory conditions
- Backend multiplayer infrastructure (Supabase integration)

### 🚧 Priority 1: Visual Systems (Critical Gap)

**1. Ship Graphics System**
- **Status:** MISSING - Placeholder graphics only
- **Requirement:** Geometric SVG shapes for each ship type
- **Implementation:** Create SVG components in `/graphics/{species}/assets.tsx`
- **Design notes:** Ships ARE shapes - the "Shapeships" name is literal
- **Color system:** Neon glow effects on geometric forms (glow color indicates ship type, NOT species)

**2. Enhanced Ship Selection Interface**
- **Status:** Basic dropdown exists, needs complete redesign
- **Requirement:** Visual grid picker with:
  - Species tabs (Human, Xenite, Centaur, Ancient)
  - Category tabs (Basic Ships, Upgraded Ships)
  - Ship preview cards showing shape, stats, and powers
  - Visual cost display (line cost, upgrade requirements)
- **Current gap:** Using simple Select dropdown - not suitable for rich ship data

**3. Player Stats Dashboard**
- **Status:** Basic health tracking only
- **Requirement:** Comprehensive stat display showing:
  - Health (current/max with visual bar)
  - Aggregate damage output (from all ships)
  - Aggregate healing output (from all ships)
  - Active charges/powers
  - Resource breakdown (Lines: Saved + Bonus + Dice)
- **Implementation:** New component in `/game/display/`
- **Data support:** Backend already calculates these values

### 🚧 Priority 2: Gameplay Visualization

**4. Battlefield Visualization System**
- **Status:** MISSING - Ships only stored in arrays
- **Requirement:** Visual display system showing:
  - Ships arranged using auto-positioning rules (to be defined)
  - Ships do not have position data in game state
  - Stat annotations on ships
  - Power activation indicators
- **Technical challenge:** Need auto-positioning algorithm + visual layout
- **Design reference:** Center area in game board shows ship arrangement
- **Note:** Ships exist as data, positioning is purely visual presentation layer

**5. Enhanced Phase Indicators**
- **Status:** Basic text display only
- **Requirement:** Visual phase system showing:
  - Current phase highlight
  - Next phase preview
  - Phase-specific action prompts
  - Visual transitions between phases
- **Backend support:** Phase engine ready, just needs UI layer

**6. Lines Breakdown Display**
- **Status:** Single "lines" number only
- **Requirement:** Separate tracking and display:
  - Saved lines (carried from previous turns)
  - Bonus lines (from ship powers)
  - Dice lines (from current roll)
  - Total available
- **Data model update:** Need to track line sources separately in game state

### 🚧 Priority 3: Polish & UX

**7. Chess-Clock Timer System**
- **Status:** NOT IMPLEMENTED
- **Requirement:** Per-player time tracking
  - Display format: "MM:SS"
  - Active/inactive states
  - Time bank system (if applicable)
- **Backend update:** Add timer state to game data

**8. Battle Log & Chat Interface**
- **Status:** Basic message system exists
- **Requirement:** Formatted log display:
  - Chat messages (player communication)
  - Battle events (damage, healing, ship builds)
  - System messages (phase changes, victory)
  - Timestamps and player attribution
- **Current gap:** Messages exist in state but need proper UI formatting

**9. Ship Stat Annotations**
- **Status:** NOT IMPLEMENTED
- **Requirement:** Visual power display on ships:
  - "16 damage (4 x 4not)" - scaling notation
  - "2/3 charges" - charge tracking
  - "+2 lines" - resource generation
  - "2 healing, 1 damage" - multiple effects
- **Dependency:** Requires ship graphics system first

### 📊 Implementation Strategy

**Phase 1: Visual Foundation (Weeks 1-2)**
1. Create ship SVG graphics system
2. Build enhanced ship selection UI
3. Implement player stats dashboard

**Phase 2: Gameplay UI (Weeks 3-4)**
4. Build battlefield visualization
5. Add enhanced phase indicators
6. Implement lines breakdown tracking

**Phase 3: Polish (Week 5)**
7. Add chess-clock timers
8. Format battle log & chat
9. Add ship stat annotations

**Success Criteria:**
- Game board matches Figma design visual fidelity
- All ship graphics render with correct geometric shapes
- Player stats accurately reflect game state
- Battlefield shows spatial ship arrangement
- Phase transitions are visually clear
- All systems work in multiplayer mode

## 📝 Future Feature Notes

**Chronoswarm:**
- **Reminder:** Pink Dice

---

*These guidelines ensure consistent, maintainable code that supports the minimalist, step-by-step development approach for Shapeships.*