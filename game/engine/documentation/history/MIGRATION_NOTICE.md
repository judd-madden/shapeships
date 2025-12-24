# Documentation Migration Notice

**Date:** December 23, 2024

All game engine documentation has been reorganized into this directory (`/game/engine/documentation/`) for better organization and maintainability.

---

## 📁 File Locations (New Structure)

All `.md` files previously in `/game/engine/` have been moved to `/game/engine/documentation/`:

| File | New Location |
|------|--------------|
| ACTION_RESOLUTION_README.md | `/game/engine/documentation/ACTION_RESOLUTION_README.md` |
| BATTLE_PHASE_SPEC.md | `/game/engine/documentation/BATTLE_PHASE_SPEC.md` |
| CRITICAL_BUG_FIX.md | `/game/engine/documentation/CRITICAL_BUG_FIX.md` |
| ENDOFTURN_RESOLVER_FIXES.md | `/game/engine/documentation/ENDOFTURN_RESOLVER_FIXES.md` |
| END_OF_TURN_SPEC.md | `/game/engine/documentation/END_OF_TURN_SPEC.md` |
| ENGINE_ARCHITECTURE_SUMMARY.md | `/game/engine/documentation/ENGINE_ARCHITECTURE_SUMMARY.md` |
| GAMEENGINE_ARCHITECTURE_FIXES.md | `/game/engine/documentation/GAMEENGINE_ARCHITECTURE_FIXES.md` |
| GAMEENGINE_POLISH_FIXES.md | `/game/engine/documentation/GAMEENGINE_POLISH_FIXES.md` |
| GAMEPHASES_ARCHITECTURE_FIXES.md | `/game/engine/documentation/GAMEPHASES_ARCHITECTURE_FIXES.md` |
| IMPLEMENTATION_SUMMARY.md | `/game/engine/documentation/IMPLEMENTATION_SUMMARY.md` |
| IMPORT_FIXES.md | `/game/engine/documentation/IMPORT_FIXES.md` |
| QUICK_REFERENCE.md | `/game/engine/documentation/QUICK_REFERENCE.md` |
| RULESENGINE_REFACTOR.md | `/game/engine/documentation/RULESENGINE_REFACTOR.md` |
| SURGICAL_FIXES_APPLIED.md | `/game/engine/documentation/SURGICAL_FIXES_APPLIED.md` |
| SYSTEM_CONSTRAINTS.md | `/game/engine/documentation/SYSTEM_CONSTRAINTS.md` |

---

## 🎯 Why This Change?

**Benefits:**
- ✅ Cleaner `/game/engine/` directory (only code files)
- ✅ All documentation in one place
- ✅ Easier to navigate and discover docs
- ✅ Better IDE folder collapsing
- ✅ Follows standard project structure patterns

**Pattern:**
```
/game/engine/
  ├── documentation/     ← All .md files
  │   ├── README.md
  │   ├── SYSTEM_CONSTRAINTS.md
  │   └── ...
  ├── GameEngine.tsx     ← Code files only
  ├── GamePhases.tsx
  ├── RulesEngine.tsx
  └── ...
```

---

## 📚 Quick Navigation

**Start Here:**
→ [Documentation Index (README.md)](./README.md)

**Most Important Docs:**
- [System Constraints](./SYSTEM_CONSTRAINTS.md) - Hard rules (READ FIRST)
- [Engine Architecture Summary](./ENGINE_ARCHITECTURE_SUMMARY.md) - Complete overview
- [Quick Reference](./QUICK_REFERENCE.md) - Fast lookup

**See the complete index:** [README.md](./README.md)

---

## 🔗 Updated References

The following files have been updated to reference the new documentation locations:

- `/README.md` - Project root README
- `/guidelines/DOCUMENTATION_INDEX.md` - Master documentation index
- `/game/engine/documentation/README.md` - Engine documentation index (NEW)

---

**All documentation content remains unchanged - only file locations have been updated.**
