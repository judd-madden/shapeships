# Shapeships

A minimalist multiplayer turn-based strategy game built with React, Tailwind CSS, and Supabase.

**Version:** Make 444 | Git Commit: 260106-5  
**Development Status:** Active development with GPT as director

---

## 📚 **START HERE: Canonical Handoff Document**

🎯 **For all developers and AI assistants:**  
→ Read **[/documentation/architecture/canonical-handoff.md](documentation/architecture/canonical-handoff.md)** first

This document is the single source of truth for:
- System architecture and design decisions
- Implementation patterns and constraints
- Phase structure and game mechanics
- Critical invariants and safety rules

---

## 📋 Quick Navigation

**For New Developers:**
1. ⭐ [Canonical Handoff Document](documentation/architecture/canonical-handoff.md) - **MOST IMPORTANT**
2. [Guidelines.md](Guidelines.md) - Development rules and standards
3. [DOCUMENTATION_INDEX.md](guidelines/DOCUMENTATION_INDEX.md) - Complete documentation map

**Key Documentation:**
- **Architecture:** `/documentation/architecture/` - System design and patterns
- **Engine Docs:** `/game/engine/documentation/` - Game engine architecture
- **Guidelines:** `/guidelines/` - Project specifications and rules

---

## 🎮 Current Status: Alpha Development

**Active Features:**
- ✅ Complete authentication system (Supabase)
- ✅ Multiplayer framework with real-time sync
- ✅ Game engine with 3-phase turn structure
- ✅ 71 ship graphics across 4 species (Human, Xenite, Centaur, Ancient)
- ✅ Rules panel with Core Rules content
- ✅ Build Kit UI primitives library
- ✅ Space background and color palette system

**In Active Development:**
- 🚧 Species-specific rules pages
- 🚧 Enhanced game interface components
- 🚧 Turn timing visualizations

---

## 🏗️ Architecture Overview

### Core Systems

**Frontend:**
- React + TypeScript + Tailwind CSS v4
- Modular component architecture (shells → panels → primitives)
- Central Build Kit for reusable UI components

**Backend:**
- Supabase Edge Functions (Hono web server)
- KV store for game state
- Real-time polling (5-second intervals)
- RESTful API with comprehensive endpoints

**Game Engine:**
- Pure function design (no React dependencies)
- Separated logic (`/game/engine/`) and display (`/game/display/`)
- 3-phase turn system: Build → Battle → End of Turn Resolution
- Species-based ship mechanics with CSV auto-generation

### Directory Structure

```
├── /game/                       # Game engine and logic
│   ├── /engine/                 # Core game logic
│   │   ├── /documentation/      # Engine architecture docs
│   │   ├── GameEngine.tsx       # Main engine
│   │   ├── GamePhases.tsx       # Phase management
│   │   └── RulesEngine.tsx      # Rules implementation
│   ├── /display/                # UI components
│   ├── /hooks/                  # React state management
│   └── /types/                  # TypeScript interfaces
├── /graphics/                   # SVG React components by species
│   ├── /global/                 # Shared assets
│   ├── /human/                  # Human faction (21 ships)
│   ├── /xenite/                 # Xenite faction (22 ships)
│   ├── /centaur/                # Centaur faction (22 ships)
│   └── /ancient/                # Ancient faction (6 ships)
├── /components/                 # React components
│   ├── /ui/primitives/          # Build Kit - reusable UI components
│   ├── /shells/                 # Layout shells (LoginShell, MenuShell, GameShell)
│   ├── /panels/                 # Content panels (MultiplayerPanel, RulesPanel, etc.)
│   └── /dev/                    # Development tools
├── /supabase/                   # Backend edge functions
│   └── /functions/server/       # Hono server implementation
├── /documentation/              # Project documentation
│   └── /architecture/           # 📚 System architecture docs (START HERE)
├── /guidelines/                 # 📚 Development guidelines
├── /utils/                      # Utilities and helpers
└── /styles/                     # Global CSS and design tokens
```

---

## 🚀 Getting Started

### Prerequisites

- Supabase project with configured environment variables
- Edge function deployment access

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/judd-madden/shapeships-figma-make.git
   cd shapeships-figma-make
   ```

2. **Configure Supabase**
   - Set up your Supabase project
   - Deploy the edge function from `/supabase/functions/server/index.tsx`
   - Configure environment variables in Supabase dashboard

3. **Development**
   - Access the development dashboard at the root URL
   - Test all systems using the built-in testing suite
   - Use the multiplayer test for real-time game validation

---

## 🎯 Development Dashboard

The project includes a comprehensive development dashboard with:

- **System Status** - Monitor Supabase client and edge function health
- **Deployment Test** - Validate edge function deployment and endpoints
- **Authentication** - Test user signup and login functionality
- **Multiplayer Test** - Create games, share URLs, test real-time communication
- **Graphics Test** - Validate asset loading and display
- **Build Kit Showcase** - View all UI primitives
- **Game Screen** - Live game interface preview

Access by running the project and visiting the dashboard at the root URL.

---

## 🎮 Multiplayer System

**Game Creation Flow:**
1. Player creates game → generates unique 6-character ID
2. Shareable URL created → `yourdomain.com?game=ABC123`
3. Other players join via URL → real-time state sync
4. Game actions → validated and distributed to all players

**Technical Details:**
- 5-second polling architecture (appropriate for turn-based gameplay)
- KV store for persistent game state
- Session management with requireSession pattern
- Supports 1-30 simultaneous games on free tier

---

## 🎨 Design System

**Color Palette:**
- **Pastels:** Green, Red, Orange, Purple, Blue, Yellow, Pink
- **Vibrant:** Standard colors for accents and highlights
- **Greys:** 90, 70, 50, 20 for text and backgrounds
- **Core:** Black and White for base elements
- **Special:** Shapeships colors defined in globals.css

**Typography:**
- Roboto font family (already configured)
- Base font size: 14px
- Font variation settings for width control

**Build Kit Components:**
- Buttons: Primary, Menu, Ready, Action (standard & small)
- Inputs: InputField
- Controls: RadioButton, Checkbox
- Navigation: Tab, SecondaryNavItem
- Icons: BuildIcon, BattleIcon, HeartIcon, ChevronDown
- Lobby: LobbyRow
- Dice: Dice display component

---

## 🔧 Technology Stack

- **Frontend:** React, TypeScript, Tailwind CSS v4
- **Backend:** Supabase (Database, Auth, Edge Functions)
- **Real-time:** KV Store with 5-second polling
- **Server:** Hono web framework (Deno runtime)
- **Styling:** Custom Shapeships color palette with Roboto typography
- **State Management:** Custom React hooks with game engine
- **Testing:** Built-in comprehensive testing suite

---

## 📚 Key Documentation Files

**Must-Read for Development:**
- [Canonical Handoff](documentation/architecture/canonical-handoff.md) ⭐ PRIMARY
- [Guidelines.md](Guidelines.md) - Development rules
- [Engine Architecture Summary](/game/engine/documentation/ENGINE_ARCHITECTURE_SUMMARY.md)
- [System Constraints](/game/engine/documentation/SYSTEM_CONSTRAINTS.md)

**For Deep Dives:**
- [Alpha v3 Implementation Summary](documentation/architecture/alpha-v3-implementation-summary.md)
- [Phase 3.5 Corrective Summary](documentation/architecture/phase-3-5-corrective-summary.md)
- [Documentation Index](guidelines/DOCUMENTATION_INDEX.md)

---

## 📝 Development Philosophy

- **Minimalist Approach:** Clean, focused implementation without complexity
- **Step-by-step:** Comprehensive testing at each stage
- **No Assumptions:** Everything explicitly specified
- **Separation of Concerns:** Game logic separated from display components
- **AI-Safe Architecture:** Pure functions, comprehensive TypeScript interfaces
- **GPT as Director:** Active development with AI-assisted iteration

---

## 🔗 Links

- **Repository:** https://github.com/judd-madden/shapeships-figma-make.git
- **Graphics Host:** https://juddmadden.com/shapeships/images/

---

## 📄 Version History

See [VERSION.md](VERSION.md) for detailed version history.

**Current:** Make 444 | Git Commit: 260106-5  
**Status:** Alpha development with active iteration

---

**Ready for development: GPT-directed iteration with solid architectural foundation**
