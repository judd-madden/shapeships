# Documentation Cleanup Checklist

**Date:** 2024-12-23  
**Action:** Move historical .md files to /history/ folders  

---

## ✅ Quick Summary

- **Engine docs:** 22 → 11 files (50% reduction)
- **Guidelines:** 26 → 7 files (73% reduction)
- **Total archived:** 30 files
- **Total kept:** 18 files

---

## 📋 Step-by-Step Checklist

### Step 1: Create History Folders
- [ ] Create `/game/engine/documentation/history/`
- [ ] Create `/guidelines/history/`

### Step 2: Move Engine Documentation Files (11 files)

Move to `/game/engine/documentation/history/`:
- [ ] ACTION_RESOLUTION_README.md
- [ ] CRITICAL_BUG_FIX.md
- [ ] ENDOFTURN_RESOLVER_FIXES.md
- [ ] GAMEENGINE_ARCHITECTURE_FIXES.md
- [ ] GAMEENGINE_POLISH_FIXES.md
- [ ] GAMEPHASES_ARCHITECTURE_FIXES.md
- [ ] IMPLEMENTATION_SUMMARY.md
- [ ] IMPORT_FIXES.md
- [ ] MIGRATION_NOTICE.md
- [ ] RULESENGINE_REFACTOR.md
- [ ] SURGICAL_FIXES_APPLIED.md

### Step 3: Move Guidelines Files (19 files)

Move to `/guidelines/history/`:
- [ ] CONSISTENCY_CHECK_2024-12-23.md
- [ ] DESIGN_REVIEW.md
- [ ] FLUID_SCALING_STRATEGY.md
- [ ] REORGANIZATION_COMPLETE.md
- [ ] SERVER_ALIGNMENT_UPDATE_2024-12-23.md
- [ ] SIMULTANEOUS_DECLARATION_IMPLEMENTATION.md
- [ ] TYPESCRIPT_ANY_FIXES.md
- [ ] battlelog-planning.md
- [ ] phase1-type-updates-complete.md
- [ ] phase2-complete.md
- [ ] phase2-csv-parser-ready.md
- [ ] phase2-generation-complete.md
- [ ] phase2-parser-analysis.md
- [ ] phase3-critical-fixes.md
- [ ] phase3-engine-integration.md
- [ ] phase3-generation-complete.md
- [ ] phase3-integration-complete.md
- [ ] ship-data-corrections.md
- [ ] ship-data-review.md

### Step 4: Verify Remaining Files

**Verify `/game/engine/documentation/` has only these 11 files:**
- [ ] README.md
- [ ] QUICK_REFERENCE.md
- [ ] BATTLE_PHASE_SPEC.md
- [ ] END_OF_TURN_SPEC.md
- [ ] HIDDEN_DECLARATIONS_SPEC.md
- [ ] ENGINE_ARCHITECTURE_SUMMARY.md
- [ ] SYSTEM_CONSTRAINTS.md
- [ ] upon-destruction-mechanics.md
- [ ] actiontypes-contract.md
- [ ] battletypes-contract.md
- [ ] phase-timing-contract.md

**Verify `/guidelines/` has only these 7 files:**
- [ ] Guidelines.md
- [ ] DOCUMENTATION_INDEX.md
- [ ] TESTING_INSTRUCTIONS.md
- [ ] TURN_SYSTEM.md
- [ ] actiontypes-refinements-complete.md
- [ ] battletypes-refinements-complete.md
- [ ] phase3-refinements-complete.md

### Step 5: Optional - Add History READMEs
- [ ] Add `/game/engine/documentation/history/README.md`
- [ ] Add `/guidelines/history/README.md`

### Step 6: Commit
- [ ] Git commit: "Archive historical documentation to /history/ folders"

---

## 📊 Final Structure

```
/game/engine/documentation/
├── README.md
├── QUICK_REFERENCE.md
├── BATTLE_PHASE_SPEC.md
├── END_OF_TURN_SPEC.md
├── HIDDEN_DECLARATIONS_SPEC.md
├── ENGINE_ARCHITECTURE_SUMMARY.md
├── SYSTEM_CONSTRAINTS.md
├── upon-destruction-mechanics.md
├── actiontypes-contract.md
├── battletypes-contract.md
├── phase-timing-contract.md
└── history/
    ├── ACTION_RESOLUTION_README.md
    ├── CRITICAL_BUG_FIX.md
    ├── ENDOFTURN_RESOLVER_FIXES.md
    ├── GAMEENGINE_ARCHITECTURE_FIXES.md
    ├── GAMEENGINE_POLISH_FIXES.md
    ├── GAMEPHASES_ARCHITECTURE_FIXES.md
    ├── IMPLEMENTATION_SUMMARY.md
    ├── IMPORT_FIXES.md
    ├── MIGRATION_NOTICE.md
    ├── RULESENGINE_REFACTOR.md
    └── SURGICAL_FIXES_APPLIED.md

/guidelines/
├── Guidelines.md
├── DOCUMENTATION_INDEX.md
├── TESTING_INSTRUCTIONS.md
├── TURN_SYSTEM.md
├── actiontypes-refinements-complete.md
├── battletypes-refinements-complete.md
├── phase3-refinements-complete.md
└── history/
    ├── CONSISTENCY_CHECK_2024-12-23.md
    ├── DESIGN_REVIEW.md
    ├── FLUID_SCALING_STRATEGY.md
    ├── REORGANIZATION_COMPLETE.md
    ├── SERVER_ALIGNMENT_UPDATE_2024-12-23.md
    ├── SIMULTANEOUS_DECLARATION_IMPLEMENTATION.md
    ├── TYPESCRIPT_ANY_FIXES.md
    ├── battlelog-planning.md
    ├── phase1-type-updates-complete.md
    ├── phase2-complete.md
    ├── phase2-csv-parser-ready.md
    ├── phase2-generation-complete.md
    ├── phase2-parser-analysis.md
    ├── phase3-critical-fixes.md
    ├── phase3-engine-integration.md
    ├── phase3-generation-complete.md
    ├── phase3-integration-complete.md
    ├── ship-data-corrections.md
    └── ship-data-review.md
```

---

**Clean, organized, and all history preserved!**
