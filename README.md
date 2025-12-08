# Shapeships

A minimalist multiplayer turn-based strategy game built with React, Tailwind CSS, and Supabase.

---

## 📚 **NEW: Documentation Index**

**Looking for documentation?** → See **[DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)** for a complete guide to all project documentation.

**Quick Start for New Developers:**
1. Read this README for project overview
2. Read [Guidelines.md](guidelines/Guidelines.md) for development rules ⭐ **MOST IMPORTANT**
3. Read [DESIGN_REVIEW.md](DESIGN_REVIEW.md) for current design state
4. Check [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) for everything else
5. **Configure Supabase:** Copy `utils/supabase/info.tsx.template` to `utils/supabase/info.tsx` and add your credentials

---

## 🎮 Current Status: Major Version 1.0 ✅

**Complete multiplayer framework with game engine ready for rules implementation**

### ✅ Implemented Features

- **🔐 Authentication System** - Complete Supabase auth with signup/login
- **🚀 Multiplayer Framework** - Real-time game creation, joining, and state sync
- **⚡ Edge Functions** - Robust backend with comprehensive API endpoints
- **🎨 Graphics System** - Modular asset management with faction-based organization
- **🏗️ Game Engine** - Separated logic/display architecture ready for rules
- **🛠️ Development Tools** - Comprehensive testing dashboard and deployment system
- **📱 Responsive Design** - Clean, minimalist interface with Roboto typography

### 🏗️ Architecture

**Game Engine Framework:**
- `GameEngine.tsx` - Core game logic (pure functions)
- `RulesEngine.tsx` - Game-specific rules implementation (ready for Shapeships rules)
- `GameTypes.tsx` - Complete TypeScript interfaces
- `GameBoard.tsx` - Pure UI components for game rendering
- `useGameState.tsx` - React hooks bridging engine and UI

**Multiplayer Backend:**
- Supabase Edge Functions with KV store
- Real-time game state synchronization
- Player management and URL sharing
- Comprehensive system testing endpoints

**Graphics Organization:**
- `/graphics/global/` - Shared assets (space background)
- `/graphics/human/` - Human faction assets
- `/graphics/xenite/` - Xenite faction assets  
- `/graphics/centaur/` - Centaur faction assets
- `/graphics/ancient/` - Ancient faction assets

## 🚀 Getting Started

### Prerequisites

- Supabase project with configured environment variables
- Edge function deployment access

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/judd-madden/shapeships.git
   cd shapeships
   ```

2. **Configure Supabase Credentials**
   ```bash
   # Copy the template file
   cp utils/supabase/info.tsx.template utils/supabase/info.tsx
   
   # Edit utils/supabase/info.tsx with your Supabase project credentials
   # Get these from your Supabase project settings
   ```

3. **Deploy Supabase Edge Function**
   - Set up your Supabase project
   - Deploy the edge function from `/supabase/functions/server/index.tsx`
   - Configure environment variables in Supabase dashboard:
     - `SUPABASE_URL`
     - `SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `SUPABASE_DB_URL`

4. **Development**
   - Access the development dashboard at the root URL
   - Test all systems using the built-in testing suite
   - Use the multiplayer test for real-time game validation

## 🎯 Development Dashboard

The project includes a comprehensive development dashboard with:

- **System Status** - Monitor Supabase client and edge function health
- **Deployment Test** - Validate edge function deployment and endpoints
- **Authentication** - Test user signup and login functionality
- **Multiplayer Test** - Create games, share URLs, test real-time communication
- **Graphics Test** - Validate asset loading and display
- **Game Screen** - Preview game interface (ready for rules implementation)

Access by running the project and visiting the dashboard at the root URL.

## 🎮 Multiplayer System

**Game Creation Flow:**
1. Player creates game → generates unique 6-character ID
2. Shareable URL created → `yourdomain.com?game=ABC123`
3. Other players join via URL → real-time state sync
4. Game actions → validated and distributed to all players

**Real-time Features:**
- Live player joining/leaving
- Message system between players
- Game state synchronization
- Action validation and processing

## 📁 Project Structure

```
├── /game/                    # Game engine and logic
│   ├── /engine/             # Core game logic (rules-ready)
│   ├── /display/            # UI components
│   ├── /hooks/              # React state management
│   └── /types/              # TypeScript interfaces
├── /graphics/               # Asset management by faction
├── /components/             # React components
├── /supabase/               # Backend edge functions
├── /utils/                  # Utilities and helpers
└── /styles/                 # Global CSS and design tokens
```

## 🔧 Technology Stack

- **Frontend:** React, TypeScript, Tailwind CSS v4
- **Backend:** Supabase (Database, Auth, Edge Functions)
- **Real-time:** Supabase KV Store with polling
- **Styling:** Custom Shapeships color palette with Roboto typography
- **State Management:** Custom React hooks with game engine
- **Testing:** Built-in comprehensive testing suite

## 🎨 Design System

**Color Palette:**
- **Pastels:** Green, Red, Orange, Purple, Blue, Yellow, Pink
- **Vibrant:** Standard colors for accents and highlights
- **Greys:** 90, 70, 50, 20 for text and backgrounds
- **Core:** Black and White for base elements

**Typography:** Roboto font family with 14px base size

## 🚧 Next Development Phase

**Ready for Implementation:**
1. **Game Rules** - Shapeships-specific mechanics in `RulesEngine.tsx`
2. **Ship Graphics** - Integration of faction-specific ship assets
3. **Game Interface** - Detailed game board and interaction screens
4. **Polish** - Final UI refinements and animations

The game engine framework is designed to seamlessly accept game rules while maintaining the established multiplayer and graphics systems.

## 📝 Development Approach

- **Minimalist Philosophy** - Clean, focused implementation
- **Step-by-step** - Build and test incrementally
- **No Assumptions** - Explicit specifications for all content and styling
- **Supabase Integration** - Only when necessary, with comprehensive testing

## 🔗 Links

- **Repository:** https://github.com/judd-madden/shapeships
- **Documentation:** See [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)

## 📄 License

See [Attributions.md](Attributions.md) for third-party component licenses.

---

**Ready for the next phase: Game rules implementation and ship graphics integration**