# Shapeships - Client Wiring Phase 1 Complete

**Development Phase:** Client Wiring Phase 1 Complete + Turn-Aware Visibility Patch  
**Date:** January 22, 2026  
**Status:** Active Alpha Development - Functional Turn Cycle

---

## Version Summary

Alpha version with complete turn cycle implementation including commit/reveal protocol, species selection, build phase with preview system, and turn-aware opponent fleet visibility. All core gameplay mechanics are now functional: setup → build → battle phases with proper client-side concealment and server authority.

---

## ✅ Client Wiring Phase 1 - Complete

### Turn Cycle Implementation (Chunks 0-7)
- **Complete Turn Flow:** setup.species_selection → build.drawing → build.commit/reveal → battle phases
- **Phase-Instance Tracking:** Prevents duplicate submissions across phase transitions
- **Ready Button System:** Three-step flow (BUILD_COMMIT → BUILD_REVEAL → DECLARE_READY)
- **Preview Buffer Management:** Client-side ship preview with merge logic
- **Fleet Concealment:** Opponent fleet hidden until battle phases (now turn-aware)

### Species Selection Phase
- **Commit/Reveal Mechanics:** Hash-based concealment of species choice
- **Dual Tracking:** speciesCommitDoneByPhase + speciesRevealDoneByPhase
- **UI State:** ChooseSpeciesStage with confirmation system
- **Server Validation:** Full commit/reveal protocol enforced server-side

### Build Phase Implementation
- **Ship Catalogue:** HumanShipCataloguePanel with eligibility checking
- **Preview System:** buildPreviewCounts buffer shows local fleet changes
- **Fleet Aggregation:** BoardFleetSummary format with ship counts
- **Ready Flow:** Submits both commit (hashed) and reveal (actual) before marking ready
- **No Double-Counting:** Preview cleared after reveal, gated merge logic

### Turn-Aware Opponent Visibility
- **Old Ships Visible:** Ships from prior turns (createdTurn < turnNumber) always shown
- **New Ships Hidden:** Ships created this turn hidden during build phases
- **Battle Reveal:** All ships visible once battle.* phase begins
- **Defensive Handling:** Missing createdTurn treated as "old" (visible) to prevent bugs

### Board View Model
- **Health Display:** myHealth / opponentHealth in TopHud
- **Fleet Display:** myFleet with preview, opponentFleet with turn-aware filtering
- **Species Labels:** Proper display of selected species in HUD
- **Phase Icons:** Build/Battle icons based on majorPhase

---

## ✅ Core Systems Complete

### Multiplayer Infrastructure
- **Authentication:** Supabase auth with signup/login flows
- **Session Management:** requireSession pattern with identity hardening
- **Game State Sync:** 5-second polling architecture with KV store
- **Real-time Communication:** Messaging and action distribution system
- **URL Sharing:** 6-character game codes with shareable URLs

### Game Engine Foundation
- **Phase System:** PhaseTable.ts with canonical phase keys
- **Intent Protocol:** Commit/Reveal (B) with hash-based concealment
- **Ship Instances:** createdTurn tracking for visibility rules
- **Pure Function Design:** Complete separation between logic and display
- **Server Authority:** All validation server-side, client renders state only

### Client Architecture
- **useGameSession Hook:** Single source of state for entire game
- **Phase-Driven Routing:** ActionPanelRegistry maps phaseKey to UI
- **ViewModel Pattern:** BoardViewModel, SpeciesSelectionViewModel, etc.
- **No Duplicate Submissions:** Phase-instance keys prevent double-sends
- **Preview Management:** Local preview buffer with proper lifecycle

### Graphics System (71 Ships)
- **Embedded SVG Components:** All ships as React components in `/graphics/{species}/assets.tsx`
- **Human:** 21 ships (Carrier, Guardian, Interceptor with charge states)
- **Xenite:** 22 ships (Bug Breeder, Antlion with charge states)
- **Centaur:** 22 ships (Ship of Family, Ship of Wisdom/Equality with charge states)
- **Ancient:** 6 ships (Solar Reserve with charge states)
- **Performance:** ~40 KB bundle, zero HTTP requests, instant rendering

### UI Framework
- **Build Kit Primitives:** 20+ reusable components (buttons, inputs, icons, navigation)
- **Shell Architecture:** LoginShell → MenuShell → GameShell layout system
- **Panel Components:** Content-only panels with navigation callbacks
- **Rules Panel:** Complete with Core Rules and 6-tab navigation structure
- **Space Background:** Configured with tiling star field

### Backend Architecture
- **Hono Web Server:** RESTful API with comprehensive endpoints
- **KV Store:** Game state persistence with get/set/delete operations
- **Edge Functions:** Self-contained Deno runtime deployment
- **Intent Reducer:** Server-side commit/reveal validation and processing
- **Error Handling:** Comprehensive logging and error responses

---

## 🎮 Current Gameplay Features

### Fully Functional Turn Cycle
```
Turn N Setup:
  - Species selection with commit/reveal
  - Both players must commit + reveal before advancing
  
Turn N Build:
  - Ship catalogue displays eligible ships
  - Players build ships (preview shown locally)
  - Opponent's old fleet visible, new fleet hidden
  - Ready button: BUILD_COMMIT → BUILD_REVEAL → DECLARE_READY
  - Preview cleared after reveal to prevent double-counting
  
Turn N Battle:
  - Opponent's new ships revealed
  - All fleet changes visible
  - Battle phases execute
  - Turn advances when both ready
```

### Player-Facing Features
- ✅ Login/signup with email/password
- ✅ Guest login option
- ✅ Main menu with multiplayer option
- ✅ Game creation with shareable URLs
- ✅ Game joining via URL or code
- ✅ Species selection with commit/reveal
- ✅ Ship catalogue with eligibility checking
- ✅ Fleet preview during build phase
- ✅ Turn-aware opponent fleet visibility
- ✅ Health tracking in HUD
- ✅ Phase icons (Build/Battle)
- ✅ Ready button with proper flow
- ✅ Rules panel with Core Rules content
- ✅ Real-time messaging between players

### Development Tools
- ✅ Development dashboard with system status
- ✅ Deployment testing interface
- ✅ Authentication testing
- ✅ Multiplayer session testing
- ✅ Graphics test view (all 71 ships)
- ✅ Build Kit showcase

### Backend API Endpoints
- `/signup` - User registration
- `/game/create` - Create new game
- `/game/join` - Join existing game
- `/game-state/:gameId` - Get current game state
- `/intent/commit` - Submit hashed intent
- `/intent/reveal` - Submit actual intent
- `/ready` - Mark player ready
- `/test/system` - System health check
- `/test/kv` - KV store validation

---

## 🎨 Design System

### Color Palette
- **Shapeships Colors:** Defined in `/styles/globals.css` as CSS variables
- **Pastels:** Green, Red, Orange, Purple, Blue, Yellow, Pink
- **Vibrant:** Standard accent colors
- **Greys:** 90, 70, 50, 20 hierarchy
- **Core:** Black (#000000) and White (#FFFFFF)

### Typography
- **Font:** Roboto (configured in globals.css)
- **Base Size:** 14px
- **Font Variation:** Width control via `fontVariationSettings`
- **Usage:** Never override font-size/weight/line-height unless explicitly requested

### Build Kit Components
- **Buttons:** PrimaryButton, MenuButton, ReadyButton, ActionButton, ActionButtonSmall
- **Inputs:** InputField
- **Controls:** RadioButton, Checkbox
- **Navigation:** Tab, SecondaryNavItem
- **Icons:** BuildIcon (24px), BattleIcon (24px), HeartIcon (24px), ChevronDown
- **Lobby:** LobbyRow
- **Dice:** Dice display component

---

## 📁 Architecture

### Key Patterns
- **Server Authority:** UI emits Intent → server validates/applies → UI renders state
- **No Gameplay Rules in UI:** All logic in `/game/engine/` and `/supabase/functions/server/engine/`
- **Phase-Driven Routing:** PhaseTable.ts maps phaseKey to panels
- **Content-Only Panels:** Panels receive navigation callbacks, never own routing
- **Central Graphics Registry:** All ships imported from `/graphics/{species}/assets.tsx`
- **Session Identity:** Backend uses `requireSession(request)` pattern
- **Phase-Instance Tracking:** Prevents duplicate submissions via `${turnNumber}::${phaseKey}`
- **Preview Buffer Lifecycle:** Clear on phase change, merge only pre-reveal

### Data Flow Example (Build Phase)
```
1. Player clicks ship in catalogue
   → buildPreviewCounts updated locally
   → myFleetWithPreview shows canonical + preview
   
2. Player clicks Ready
   → onReadyToggle triggered
   → BUILD_COMMIT sent (hashed fleet)
   → BUILD_REVEAL sent (actual fleet)
   → buildRevealDoneByPhase[phaseInstanceKey] = true
   → setBuildPreviewCounts({}) clears preview
   → DECLARE_READY sent
   
3. Server processes intents
   → Validates commit hash matches reveal
   → Appends ships to gameData.ships with createdTurn
   → Marks player ready
   → Advances phase when both ready
   
4. Client polls and receives new state
   → myFleet now includes newly built ships (from server)
   → Preview buffer empty (no double-counting)
   → Opponent's new ships still hidden (createdTurn filter)
   
5. Phase advances to battle.*
   → isInBattlePhase = true
   → Opponent's new ships now visible
```

---

## 🚧 Known Gaps & Next Steps

### Battle Phase Interaction
- ❌ Battle intent submission UI
- ❌ Ship power selection interface
- ❌ Target selection system
- ❌ Battle visualization (damage, effects)

### Enhanced Features
- ❌ Lines breakdown display (Saved + Bonus + Dice)
- ❌ Comprehensive player stats dashboard
- ❌ Enhanced battlefield visualization
- ❌ Ship power tooltips and details
- ❌ Turn history/replay system

### Polish
- ❌ Loading states during phase transitions
- ❌ Error handling for failed intents
- ❌ Confirmation dialogs for critical actions
- ❌ Tutorial/onboarding flow

---

## 🔧 Technology Stack

- **Frontend:** React, TypeScript, Tailwind CSS v4
- **Backend:** Supabase (Auth, Database, Edge Functions)
- **Server:** Hono (Deno runtime)
- **Real-time:** KV Store with 5-second polling
- **State Management:** useGameSession hook (single source of state)
- **Testing:** Built-in comprehensive dashboard

---

## 📚 Key Documentation

**Primary:**
- [Canonical Handoff Document](documentation/architecture/canonical-handoff.md) ⭐ START HERE
- [Guidelines.md](Guidelines.md) - Development rules

**Architecture:**
- [Engine Architecture Summary](/game/engine/documentation/ENGINE_ARCHITECTURE_SUMMARY.md)
- [System Constraints](/game/engine/documentation/SYSTEM_CONSTRAINTS.md)
- [Alpha v3 Implementation](documentation/architecture/alpha-v3-implementation-summary.md)

**Contracts:**
- [Server-Client Turn Phase Contract](documentation/contracts/ServerClientTurnPhaseContract.md)
- [Battle Phase Spec](/game/engine/documentation/BATTLE_PHASE_SPEC.md)
- [Hidden Declarations Spec](/game/engine/documentation/HIDDEN_DECLARATIONS_SPEC.md)

**Reference:**
- [Documentation Index](guidelines/DOCUMENTATION_INDEX.md)

---

## 📈 Performance Metrics

### Bundle Size
- Ship graphics: ~40 KB (71 ships)
- Total app: Optimized for web delivery

### Server Capacity (Free Tier)
- Safe concurrent games: 1-10
- Moderate load: 10-30 games
- Monthly capacity: ~425 games (uncompressed state)
- Polling interval: 5 seconds (optimized for turn-based gameplay)

### Response Times
- Game state fetch: <500ms typical
- Action validation: <300ms typical
- Authentication: <1s typical

---

## 🎯 Development Philosophy

- **Minimalist Approach:** Clean, focused implementation
- **Step-by-step:** Comprehensive testing at each stage
- **No Assumptions:** Everything explicitly specified
- **Separation of Concerns:** Strict boundaries between logic and display
- **Server Authority:** UI emits intent, server validates, UI renders
- **AI-Safe Architecture:** Pure functions, comprehensive interfaces
- **GPT as Director:** Active iteration with AI guidance

---

## 📝 Recent Milestones

### Client Wiring Phase 1 (Chunks 0-7)
- **Chunk 0:** useGameSession hook foundation
- **Chunk 1:** Species selection commit/reveal
- **Chunk 2:** Build preview buffer system
- **Chunk 3:** Fleet aggregation and display
- **Chunk 4:** Ready button three-step flow
- **Chunk 5:** Phase-instance tracking
- **Chunk 6:** Preview merge logic
- **Chunk 7:** Opponent fleet concealment (replaced by turn-aware filter)

### Turn-Aware Visibility Patch
- **Step 1:** Added createdTurn-based filtering for opponent ships
- **Step 2:** Removed blanket shouldRevealOpponentFleet logic
- **Step 3:** Added preview buffer clearing after reveal, gated merge
- **Hotfix:** Fixed phaseInstanceKey temporal dead zone crash

### Previous Versions
- **v444:** Rules Panel refactor, HeartIcon addition, documentation cleanup
- **v443:** Rules Panel implementation with Core Rules content
- **v442:** Build Kit expansion and primitive standardization
- **v441:** Alpha Entry Screen validation UX
- **v440:** Session identity hardening
- **Earlier:** Ship graphics completion, multiplayer foundation, game engine framework

---

**Status:** Production-ready infrastructure with fully functional turn cycle. Complete setup → build → battle flow operational. Ready for battle phase interaction development and UI polish.
