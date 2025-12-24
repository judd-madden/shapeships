# Game Engine Documentation Index

This directory contains comprehensive documentation for the Shapeships game engine architecture and implementation.

---

## 📚 Quick Start Guide

**New to the codebase?** Read these documents in order:

1. **[System Constraints](./SYSTEM_CONSTRAINTS.md)** - Hard rules and invariants (READ FIRST)
2. **[Engine Architecture Summary](./ENGINE_ARCHITECTURE_SUMMARY.md)** - Complete architecture overview
3. **[Quick Reference](./QUICK_REFERENCE.md)** - Fast lookup for common patterns

---

## 🏗️ Architecture Documentation

### Core Engine Components

- **[Engine Architecture Summary](./ENGINE_ARCHITECTURE_SUMMARY.md)** - Complete overview of all engines and their responsibilities
- **[System Constraints](./SYSTEM_CONSTRAINTS.md)** - Non-negotiable hard constraints and invariants

### GamePhases Engine

- **[GamePhases Architecture Fixes](./GAMEPHASES_ARCHITECTURE_FIXES.md)** - Recent architectural improvements and fixes
- **[Battle Phase Specification](./BATTLE_PHASE_SPEC.md)** - Detailed Battle Phase implementation (simultaneous commitments)
- **[Hidden Declarations Specification](./HIDDEN_DECLARATIONS_SPEC.md)** - Complete guide to hidden declarations in Build and Battle phases

### GameEngine

- **[GameEngine Architecture Fixes](./GAMEENGINE_ARCHITECTURE_FIXES.md)** - Core game engine improvements
- **[GameEngine Polish Fixes](./GAMEENGINE_POLISH_FIXES.md)** - Polish and refinement updates

### RulesEngine

- **[RulesEngine Refactor](./RULESENGINE_REFACTOR.md)** - Complete refactor documentation aligning with new architecture

### EndOfTurnResolver

- **[End of Turn Specification](./END_OF_TURN_SPEC.md)** - Detailed End of Turn Resolution algorithm
- **[EndOfTurn Resolver Fixes](./ENDOFTURN_RESOLVER_FIXES.md)** - Resolution engine improvements

### ActionResolver

- **[Action Resolution README](./ACTION_RESOLUTION_README.md)** - Action resolution layer documentation

---

## 🔧 Bug Fixes & Updates

- **[Critical Bug Fix](./CRITICAL_BUG_FIX.md)** - Critical bug fixes applied
- **[Surgical Fixes Applied](./SURGICAL_FIXES_APPLIED.md)** - Targeted surgical fixes
- **[Import Fixes](./IMPORT_FIXES.md)** - Import-related error fixes

---

## 📖 Implementation Guides

- **[Implementation Summary](./IMPLEMENTATION_SUMMARY.md)** - Complete implementation overview
- **[Quick Reference](./QUICK_REFERENCE.md)** - Fast reference for common patterns

---

## 🎯 By Topic

### Phase Management
- [System Constraints](./SYSTEM_CONSTRAINTS.md) - 3-phase system rules
- [GamePhases Architecture Fixes](./GAMEPHASES_ARCHITECTURE_FIXES.md) - Phase engine details
- [Battle Phase Specification](./BATTLE_PHASE_SPEC.md) - Battle Phase specifics

### Action Processing
- [Action Resolution README](./ACTION_RESOLUTION_README.md) - Action resolution
- [RulesEngine Refactor](./RULESENGINE_REFACTOR.md) - Action validation

### Effect Resolution
- [End of Turn Specification](./END_OF_TURN_SPEC.md) - Effect resolution algorithm
- [EndOfTurn Resolver Fixes](./ENDOFTURN_RESOLVER_FIXES.md) - Resolver improvements

### Architecture
- [Engine Architecture Summary](./ENGINE_ARCHITECTURE_SUMMARY.md) - Complete architecture
- [System Constraints](./SYSTEM_CONSTRAINTS.md) - Hard invariants

---

## 🔍 Finding What You Need

### "How do I...?"

**Validate an action?**
→ [RulesEngine Refactor](./RULESENGINE_REFACTOR.md)

**Manage phases?**
→ [GamePhases Architecture Fixes](./GAMEPHASES_ARCHITECTURE_FIXES.md)

**Resolve damage/healing?**
→ [End of Turn Specification](./END_OF_TURN_SPEC.md)

**Handle Battle Phase commitments?**
→ [Battle Phase Specification](./BATTLE_PHASE_SPEC.md)

**Understand the overall architecture?**
→ [Engine Architecture Summary](./ENGINE_ARCHITECTURE_SUMMARY.md)

---

## 📋 Document Status

| Document | Status | Last Updated |
|----------|--------|--------------|
| System Constraints | ✅ Current | 2024-12-23 |
| Engine Architecture Summary | ✅ Current | 2024-12-23 |
| GamePhases Architecture Fixes | ✅ Current | 2024-12-23 |
| RulesEngine Refactor | ✅ Current | 2024-12-23 |
| End of Turn Specification | ✅ Current | 2024-12-23 |
| Battle Phase Specification | ✅ Current | 2024-12-23 |
| Import Fixes | ✅ Current | 2024-12-23 |
| Quick Reference | ✅ Current | 2024-12-23 |
| Action Resolution README | ⚠️ Superseded | See System Constraints |
| Implementation Summary | ✅ Current | 2024-12-23 |
| GameEngine Architecture Fixes | ✅ Current | 2024-12-23 |
| GameEngine Polish Fixes | ✅ Current | 2024-12-23 |
| EndOfTurn Resolver Fixes | ✅ Current | 2024-12-23 |
| Critical Bug Fix | ✅ Current | 2024-12-23 |
| Surgical Fixes Applied | ✅ Current | 2024-12-23 |

---

## 🎓 Learning Path

### For New Developers

**Day 1:** Understand the rules
1. [System Constraints](./SYSTEM_CONSTRAINTS.md) - Learn hard invariants
2. [Quick Reference](./QUICK_REFERENCE.md) - Common patterns

**Day 2:** Understand the architecture
3. [Engine Architecture Summary](./ENGINE_ARCHITECTURE_SUMMARY.md) - Big picture
4. [GamePhases Architecture Fixes](./GAMEPHASES_ARCHITECTURE_FIXES.md) - Phase management

**Day 3:** Understand specific systems
5. [Battle Phase Specification](./BATTLE_PHASE_SPEC.md) - Battle mechanics
6. [End of Turn Specification](./END_OF_TURN_SPEC.md) - Resolution mechanics
7. [RulesEngine Refactor](./RULESENGINE_REFACTOR.md) - Action validation

---

## 🚨 Important Notes

### Hard Invariants (Never Violate)

1. **Health changes ONLY in EndOfTurnResolver**
2. **Win/loss determination ONLY in EndOfTurnResolver**
3. **Phase transitions ONLY in GamePhasesEngine**
4. **Three major phases:** Build, Battle, End of Turn Resolution
5. **Battle Phase:** Simultaneous commitments (max 2 windows)

See [System Constraints](./SYSTEM_CONSTRAINTS.md) for complete list.

---

## 📞 Getting Help

**If you're stuck:**

1. Check the [Quick Reference](./QUICK_REFERENCE.md) first
2. Read the relevant architecture document
3. Review recent bug fixes for similar issues
4. Check the system constraints to ensure you're not violating invariants

---

**Last Updated:** 2024-12-23  
**Version:** 2.0.0 (Post-refactor)