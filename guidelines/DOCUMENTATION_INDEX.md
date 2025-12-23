# 📚 Shapeships Documentation Index

**Master Reference** - Start here for all project documentation

Last Updated: December 8, 2024  
**Last Synced to GitHub**: December 8, 2024 ✅

---

## 🎯 Quick Start Guide

**New to this project? Read in this order:**

1. **[README.md](#readme)** - Project overview and current status
2. **[Guidelines.md](#guidelines)** - Development rules and philosophy (MOST IMPORTANT)
3. **[DESIGN_REVIEW.md](#design-review)** - Recent design analysis and integration plan
4. **[VERSION.md](#version)** - Version history and completed features

---

## 📁 Documentation Files

### Primary Documentation

#### <a name="readme"></a>README.md
**Location**: `/README.md`  
**Purpose**: Project introduction and overview  
**Read if**: You need a high-level summary of what Shapeships is  

**Contains:**
- Project status (Major Version 1.0)
- Implemented features checklist
- Architecture overview
- Technology stack
- Project structure
- Getting started instructions
- Development dashboard guide
- Multiplayer system overview

**Key Info:**
- Starting point for new developers
- Lists all completed foundational systems
- Explains development tools vs player interface separation

---

#### <a name="guidelines"></a>Guidelines.md
**Location**: `/guidelines/Guidelines.md`  
**Purpose**: **CORE DEVELOPMENT RULES** - Read this first before making any changes  
**Read if**: You're about to write any code or make design decisions  

**Contains:**
- 🎯 Project Philosophy (minimalist approach)
- 🏗️ Architecture Rules (separation of concerns)
- 🎨 Design System (colors, typography, layout)
- 🔧 Code Quality standards
- 🎮 Game Development specifics
- 🔌 Performance & Infrastructure (polling architecture)
- 📋 Development Workflow
- 🎯 Current Development Priorities

**Key Sections:**
- **Graphics System** - Ship graphics architecture (SVGs as React components)
- **Multiplayer Integration** - Server capacity, polling, bandwidth optimization
- **Phase Management** - 3-phase system (Build, Battle, End of Turn Resolution) explained
- **Ship System** - Ships as power generators, no position data
- **Development Priorities** - Visual systems, gameplay visualization, polish

**Critical Info:**
- Ships ARE shapes - literal geometric SVGs
- Glow colors indicate ship type, NOT species
- Spectator system fully documented
- Polling: 5 seconds, not WebSockets (for now)
- Graphics stored within app, not externally hosted

---

### Design & Planning

#### <a name="design-review"></a>DESIGN_REVIEW.md
**Location**: `/guidelines/DESIGN_REVIEW.md`  
**Purpose**: Comprehensive design review conducted before Figma import  
**Read if**: You need to understand the design philosophy or plan Figma integration  

**Contains:**
- 🎯 Game Rules Architecture (3-phase system: Build, Battle, End of Turn Resolution)
- 🎨 Action Panel Design Review (confirmed states)
- 🖥️ Full Game Board Design Analysis (layout structure)
- 🔧 Test Interface Clarifications (which test to use)
- 🎮 Spectator System (full implementation details)
- 🚀 Figma Import Strategy (file structure, integration phases)
- 📊 Implementation Status (working, needs enhancement, deferred)
- 🎯 Development Roadmap (week-by-week priorities)

**Key Insights:**
- **Effect Queue Visualization** (-3/+2 health preview) is brilliant
- **Game Test Interface** is the primary multiplayer reference
- **Ship graphics** use arbitrary pixel values: `w-[52px] h-[32px]`
- **Battle log vs Chat** separation rationale
- **Grade: A+** - Production-ready design

**When to Reference:**
- Before importing Figma components
- Planning UI implementation
- Understanding design decisions
- Figma-to-code integration strategy

---

#### <a name="fluid-scaling"></a>FLUID_SCALING_STRATEGY.md
**Location**: `/guidelines/FLUID_SCALING_STRATEGY.md`  
**Purpose**: Viewport and content scaling strategy (not yet implemented)  
**Read if**: Implementing responsive scaling or fluid typography  

**Contains:**
- Problem statement (mobile to desktop without breakpoints)
- Solution 1: Whole-app viewport scaling (CSS clamp)
- Solution 2: Dynamic content scaling (fleet area)
- Solution 3: SVG ship graphics scaling (em-based)
- Solution 4: CSS variables for advanced scaling
- Tailwind integration guide
- Implementation checklist
- Testing strategy

**Status**: 📝 Documented - To be implemented after Figma import

**Key Strategy:**
```css
/* Viewport scaling */
:root {
  font-size: clamp(10px, 0.97vw, 14px);
}
```

**When to Use:**
- After Figma designs are imported
- When building responsive layouts
- When ships overflow screen space

---

### Technical Documentation

#### <a name="action-resolution"></a>ACTION_RESOLUTION_README.md
**Location**: `/game/engine/ACTION_RESOLUTION_README.md`  
**Purpose**: Deep dive into action resolution system  
**Read if**: Working with game actions, phases, or power activation  

**Contains:**
- Architecture overview (3-layer system)
- Core concepts (phase vs action state, mandatory vs optional)
- Action resolution flow
- API reference (ActionResolver class, useActionResolver hook)
- Phase-specific implementation (Charge Declaration, Drawing, etc.)
- Multiplayer integration (server-side & client-side)
- Effect queue system
- Charge tracking
- Testing checklist
- Known limitations & TODOs

**Key Classes:**
- `ActionResolver` - Calculates and resolves player actions
- `useActionResolver` - React hook for action management

**When to Reference:**
- Implementing new ship powers
- Adding new game phases
- Debugging action flow
- Multiplayer action synchronization

---

#### <a name="typescript-fixes"></a>TYPESCRIPT_ANY_FIXES.md
**Location**: `/guidelines/TYPESCRIPT_ANY_FIXES.md`  
**Purpose**: Documentation of TypeScript `any` type removal  
**Read if**: Understanding the type system or adding new types  

**Contains:**
- Summary of 20+ `any` types replaced
- Files modified (GameTypes, ShipTypes, GameEngine, ShipPowers)
- New types created (15+ interfaces)
- Type safety improvements (before/after comparison)
- Action data type examples
- Testing recommendations
- Benefits achieved

**Key Achievement:**
- **0 `any` types** - Complete type safety
- **Full IDE autocomplete** for all action payloads
- **Self-documenting** code through types

**When to Reference:**
- Adding new game actions
- Creating new interfaces
- Understanding action data structure
- Following TypeScript strict guidelines

---

### Testing & Development

#### <a name="game-test-readme"></a>GameTestReadme.md
**Location**: `/game/test/GameTestReadme.md`  
**Purpose**: How to use the Game Test Interface  
**Read if**: Testing game mechanics or multiplayer functionality  

**Contains:**
- Overview of test interface
- Features (species selection, ship building, multiplayer)
- Available test ships (Human faction)
- Testing actions (roll dice, build ships, set ready)
- Usage guide (starting test games, multiplayer testing)
- Technical details (game state structure, action types)
- Development notes (limitations, integration points)

**Key Info:**
- **Primary testing tool** for game mechanics
- Text-based for rapid iteration
- Uses same multiplayer backend as full game
- Validates core mechanics before UI implementation

---

#### <a name="test-readme"></a>Test README.md
**Location**: `/game/test/README.md`  
**Purpose**: Overview of test directory  
**Read if**: Understanding test interface organization  

**Contains:**
- File listing (GameTestInterface, FullPhaseTest, ActionResolverExample)
- Purpose of test directory
- Separation from production UI

**Quick Reference:**
- **GameTestInterface.tsx** - Primary multiplayer test (4-phase simplified)
- **FullPhaseTest.tsx** - 3-phase system test (Build, Battle, End of Turn Resolution) with ActionResolver
- **ActionResolverExample.tsx** - Example hook usage

---

#### <a name="testing-instructions"></a>TESTING_INSTRUCTIONS.md
**Location**: `/guidelines/TESTING_INSTRUCTIONS.md`  
**Purpose**: Setup instructions for Game Test Interface  
**Read if**: Encountering "Failed to get game state" errors  

**Contains:**
- Current status (error fix instructions)
- Quick fix (deploy edge function)
- How to use Game Test Interface
- Available test ships
- Test actions
- Troubleshooting guide
- What the interface tests
- Next steps after testing

**Common Fixes:**
- Deploy updated edge function to Supabase
- Verify deployment status
- Test endpoints

---

#### <a name="player-management"></a>README_PlayerManagement.md
**Location**: `/game/hooks/README_PlayerManagement.md`  
**Purpose**: Player management system documentation  
**Read if**: Working with player state or usePlayer hook  

**Contains:**
- Problem solved (eliminated duplicate player logic)
- Solution (centralized usePlayer hook)
- Benefits (DRY principle, cleaner JSX)
- Usage guide
- Migration status

**Key Hook:**
```tsx
const { player, updatePlayerName, toggleSpectatorMode } = usePlayer();
```

---

### Historical Documentation

#### <a name="reorganization"></a>REORGANIZATION_COMPLETE.md
**Location**: `/guidelines/REORGANIZATION_COMPLETE.md`  
**Purpose**: Historical record of file reorganization  
**Read if**: Understanding why files are organized the way they are  

**Contains:**
- Summary of reorganization (test vs production separation)
- Changes made (created `/game/test/` directory)
- Final structure
- Benefits achieved

**Status**: ✅ Completed - Historical record

**Date**: November 20, 2025

---

#### <a name="version"></a>VERSION.md
**Location**: `/VERSION.md`  
**Purpose**: Version history and milestone documentation  
**Read if**: Understanding what's been completed vs what's next  

**Contains:**
- Major Version 1.0 summary
- Completed features checklist
- Project structure
- Technical stack
- Development tools
- Next steps

**Key Milestone:**
- **Foundation Complete** - Ready for game development
- All multiplayer infrastructure working
- Clean separation of dev tools vs player interface

**Date**: December 19, 2024

---

### Supporting Files

#### <a name="attributions"></a>Attributions.md
**Location**: `/Attributions.md` *(system-protected file, remains in root)*  
**Purpose**: License attributions for third-party components  

**Contains:**
- shadcn/ui components (MIT license)
- Unsplash photos (Unsplash license)

---

## 🗺️ Documentation Navigation Map

### By Role/Task

#### **I'm a new developer** →
1. README.md (overview)
2. Guidelines.md (rules)
3. DESIGN_REVIEW.md (current state)
4. GameTestReadme.md (how to test)

#### **I'm implementing Figma designs** →
1. DESIGN_REVIEW.md (design analysis)
2. Guidelines.md (graphics system, design system)
3. FLUID_SCALING_STRATEGY.md (responsive strategy)

#### **I'm working on game logic** →
1. Guidelines.md (architecture rules)
2. ACTION_RESOLUTION_README.md (action system)
3. TYPESCRIPT_ANY_FIXES.md (type system)
4. GameTestReadme.md (testing)

#### **I'm debugging multiplayer** →
1. Guidelines.md (polling architecture)
2. DESIGN_REVIEW.md (test interface clarifications)
3. TESTING_INSTRUCTIONS.md (troubleshooting)
4. GameTestReadme.md (multiplayer testing)

#### **I'm adding new features** →
1. Guidelines.md (development workflow)
2. ACTION_RESOLUTION_README.md (if adding actions/powers)
3. TYPESCRIPT_ANY_FIXES.md (type system patterns)
4. DESIGN_REVIEW.md (implementation roadmap)

#### **I need a refresh on project approach** →
**Read this file (DOCUMENTATION_INDEX.md) + Guidelines.md**

---

## 📊 Documentation Health

| File | Status | Last Updated | Accuracy |
|------|--------|--------------|----------|
| README.md | ✅ Current | Dec 19, 2024 | High |
| Guidelines.md | ✅ Current | Ongoing | High |
| DESIGN_REVIEW.md | ✅ Current | Dec 8, 2024 | High |
| ACTION_RESOLUTION_README.md | ✅ Current | Recent | High |
| TYPESCRIPT_ANY_FIXES.md | ✅ Current | Recent | High |
| FLUID_SCALING_STRATEGY.md | 📝 Planned | Nov 21, 2025 | N/A |
| TESTING_INSTRUCTIONS.md | ⚠️ May be outdated | Unknown | Medium |
| GameTestReadme.md | ✅ Current | Recent | High |
| REORGANIZATION_COMPLETE.md | 📜 Historical | Nov 20, 2025 | High |
| VERSION.md | ✅ Current | Dec 19, 2024 | High |
| README_PlayerManagement.md | ✅ Current | Recent | High |
| Attributions.md | ✅ Current | N/A | High |

**Legend:**
- ✅ Current - Actively maintained and accurate
- 📝 Planned - Documented but not yet implemented
- ⚠️ May be outdated - Should verify before following
- 📜 Historical - Reference only, not for current guidance

---

## 🔍 Quick Reference Tables

### File Size Guide

| Documentation | Lines | Read Time | Depth |
|--------------|-------|-----------|-------|
| README.md | ~155 | 5 min | Overview |
| Guidelines.md | ~600+ | 20 min | Deep |
| DESIGN_REVIEW.md | ~800+ | 30 min | Deep |
| ACTION_RESOLUTION_README.md | ~530 | 20 min | Deep |
| TYPESCRIPT_ANY_FIXES.md | ~295 | 10 min | Medium |
| FLUID_SCALING_STRATEGY.md | ~430 | 15 min | Medium |

### Priority Reading

| Priority | File | Why |
|----------|------|-----|
| 🔴 Critical | Guidelines.md | Core development rules |
| 🔴 Critical | DESIGN_REVIEW.md | Current design state |
| 🟡 Important | ACTION_RESOLUTION_README.md | Game logic system |
| 🟡 Important | TYPESCRIPT_ANY_FIXES.md | Type system patterns |
| 🟢 Reference | README.md | Project overview |
| 🟢 Reference | GameTestReadme.md | Testing guide |

---

## 💡 Documentation Philosophy

**These docs follow the Shapeships minimalist approach:**

1. **No assumptions** - Everything is explicitly documented
2. **Step-by-step** - Complex topics broken into clear sections
3. **Decision rationale** - Not just what, but why
4. **Living documents** - Updated as project evolves
5. **Cross-referenced** - Easy navigation between related topics

---

## 🎯 Keeping Documentation Updated

### When to Update Docs

- ✅ After completing major feature
- ✅ When changing architecture decisions
- ✅ After resolving complex issues
- ✅ When adding new patterns/conventions
- ❌ Not for minor bug fixes
- ❌ Not for work-in-progress code

### Where to Document

| Change Type | Documentation File |
|-------------|-------------------|
| New feature completed | VERSION.md + README.md |
| Design decision made | DESIGN_REVIEW.md |
| Architecture change | Guidelines.md |
| New type/interface pattern | TYPESCRIPT_ANY_FIXES.md |
| Testing procedure | GameTestReadme.md or TESTING_INSTRUCTIONS.md |
| Performance optimization | Guidelines.md (Performance section) |

---

## 🚀 Next Documentation Needs

**Planned but not yet created:**

1. **SHIP_POWERS_CATALOG.md** - Comprehensive ship power reference
2. **MULTIPLAYER_API.md** - Server endpoint documentation
3. **SPECIES_DESIGN.md** - Species-specific mechanics and balance
4. **UI_COMPONENTS.md** - Figma component integration guide

---

**Remember**: When you need a project refresh, start here, then read Guidelines.md. Those two files contain 90% of what you need to know. 🎯