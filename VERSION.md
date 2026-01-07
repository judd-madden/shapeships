# Shapeships - Version 444

**Make Version:** 444  
**Git Commit:** 260106-5  
**Date:** January 6, 2026  
**Status:** Active Alpha Development - GPT as Director

---

## Version Summary

Alpha version with complete multiplayer infrastructure, 71 ship graphics, game engine foundation, and Rules Panel implementation. System architecture follows canonical handoff patterns with separation of concerns between game logic and display components.

---

## ✅ Core Systems Complete

### Multiplayer Infrastructure
- **Authentication**: Supabase auth with signup/login flows
- **Session Management**: requireSession pattern with identity hardening
- **Game State Sync**: 5-second polling architecture with KV store
- **Real-time Communication**: Messaging and action distribution system
- **URL Sharing**: 6-character game codes with shareable URLs

### Game Engine Foundation
- **3-Phase Turn System**: Build → Battle → End of Turn Resolution
- **Pure Function Design**: Complete separation between logic and display
- **Species Framework**: Support for 4 species (Human, Xenite, Centaur, Ancient)
- **Ship Power System**: Damage, healing, charges, and scaling effects
- **Turn State Management**: Ready states, phase transitions, victory conditions

### Graphics System (71 Ships)
- **Embedded SVG Components**: All ships as React components in `/graphics/{species}/assets.tsx`
- **Human**: 21 ships (Carrier, Guardian, Interceptor with charge states)
- **Xenite**: 22 ships (Bug Breeder, Antlion with charge states)
- **Centaur**: 22 ships (Ship of Family, Ship of Wisdom/Equality with charge states)
- **Ancient**: 6 ships (Solar Reserve with charge states)
- **Performance**: ~40 KB bundle, zero HTTP requests, instant rendering

### UI Framework
- **Build Kit Primitives**: 20+ reusable components (buttons, inputs, icons, navigation)
- **Shell Architecture**: LoginShell → MenuShell → GameShell layout system
- **Panel Components**: Content-only panels with navigation callbacks
- **Rules Panel**: Complete with Core Rules and 6-tab navigation structure
- **Space Background**: Configured with tiling star field

### Backend Architecture
- **Hono Web Server**: RESTful API with comprehensive endpoints
- **KV Store**: Game state persistence with get/set/delete operations
- **Edge Functions**: Self-contained Deno runtime deployment
- **Error Handling**: Comprehensive logging and error responses

---

## 🎨 Design System

### Color Palette
- **Shapeships Colors**: Defined in `/styles/globals.css` as CSS variables
- **Pastels**: Green, Red, Orange, Purple, Blue, Yellow, Pink
- **Vibrant**: Standard accent colors
- **Greys**: 90, 70, 50, 20 hierarchy
- **Core**: Black (#000000) and White (#FFFFFF)

### Typography
- **Font**: Roboto (configured in globals.css)
- **Base Size**: 14px
- **Font Variation**: Width control via `fontVariationSettings`
- **Usage**: Never override font-size/weight/line-height unless explicitly requested

### Build Kit Components
- **Buttons**: PrimaryButton, MenuButton, ReadyButton, ActionButton, ActionButtonSmall
- **Inputs**: InputField
- **Controls**: RadioButton, Checkbox
- **Navigation**: Tab, SecondaryNavItem
- **Icons**: BuildIcon (24px), BattleIcon (24px), HeartIcon (24px), ChevronDown
- **Lobby**: LobbyRow
- **Dice**: Dice display component

---

## 📁 Architecture

### Directory Structure
```
├── /game/                       # Game engine (pure functions)
│   ├── /engine/                 # Core logic
│   │   ├── /documentation/      # Architecture docs
│   │   ├── GameEngine.tsx
│   │   ├── GamePhases.tsx
│   │   └── RulesEngine.tsx
│   ├── /display/                # UI components
│   ├── /hooks/                  # React state management
│   └── /types/                  # TypeScript interfaces
├── /graphics/{species}/         # SVG React components
├── /components/
│   ├── /ui/primitives/          # Build Kit
│   ├── /shells/                 # Layout shells
│   ├── /panels/                 # Content panels
│   └── /dev/                    # Development tools
├── /supabase/functions/server/  # Backend (Hono + Deno)
├── /documentation/architecture/ # System architecture docs
├── /guidelines/                 # Development guidelines
└── /styles/                     # CSS and design tokens
```

### Key Patterns
- **Separation of Concerns**: Logic in `/game/engine/`, display in `/game/display/`
- **Content-Only Panels**: Panels receive navigation callbacks, never own routing
- **Central Graphics Registry**: All ships imported from `/graphics/{species}/assets.tsx`
- **Session Identity**: Backend uses `requireSession(request)` pattern
- **Minimal Turn Loop**: Server validates actions, clients poll for updates

---

## 🎮 Current Functionality

### Player-Facing Features
- ✅ Login/signup with email/password
- ✅ Guest login option
- ✅ Main menu with multiplayer option
- ✅ Game creation with shareable URLs
- ✅ Game joining via URL or code
- ✅ Rules panel with Core Rules content
- ✅ Real-time messaging between players
- ✅ Health tracking and victory detection

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
- `/action` - Submit game actions
- `/test/system` - System health check
- `/test/kv` - KV store validation

---

## 🚧 In Active Development

### Current Focus
- Species-specific rules pages (Human, Xenite, Centaur, Ancient)
- Turn Timings content panel
- Enhanced game interface components
- Ship selection UI improvements

### Known Gaps
- Enhanced ship selection interface (visual grid picker)
- Comprehensive player stats dashboard
- Battlefield visualization system
- Enhanced phase indicators
- Lines breakdown tracking (Saved + Bonus + Dice)

---

## 🔧 Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS v4
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **Server**: Hono (Deno runtime)
- **Real-time**: KV Store with 5-second polling
- **State Management**: Custom React hooks with game engine
- **Testing**: Built-in comprehensive dashboard

---

## 📚 Key Documentation

**Primary:**
- [Canonical Handoff Document](documentation/architecture/canonical-handoff.md) ⭐ START HERE
- [Guidelines.md](Guidelines.md) - Development rules

**Architecture:**
- [Engine Architecture Summary](/game/engine/documentation/ENGINE_ARCHITECTURE_SUMMARY.md)
- [System Constraints](/game/engine/documentation/SYSTEM_CONSTRAINTS.md)
- [Alpha v3 Implementation](documentation/architecture/alpha-v3-implementation-summary.md)

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

- **Minimalist Approach**: Clean, focused implementation
- **Step-by-step**: Comprehensive testing at each stage
- **No Assumptions**: Everything explicitly specified
- **Separation of Concerns**: Strict boundaries between logic and display
- **AI-Safe Architecture**: Pure functions, comprehensive interfaces
- **GPT as Director**: Active iteration with AI guidance

---

## 📝 Version History

- **v444** (260106-5): Rules Panel refactor, HeartIcon addition, documentation cleanup
- **v443**: Rules Panel implementation with Core Rules content
- **v442**: Build Kit expansion and primitive standardization
- **v441**: Alpha Entry Screen validation UX
- **v440**: Session identity hardening
- **Previous**: Ship graphics completion, multiplayer foundation, game engine framework

---

**Status**: Production-ready infrastructure with active feature development. System architecture stable and following canonical patterns.
