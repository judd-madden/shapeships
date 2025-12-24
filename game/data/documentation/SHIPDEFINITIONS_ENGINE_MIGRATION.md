# ShipDefinitions.engine.ts Migration Guide

**Generated:** 2024-12-24  
**Purpose:** Document all changes needed to integrate the new engine layer

---

## 📋 Summary

Created `/game/data/ShipDefinitions.engine.ts` - the crucial middle layer that converts CSV-shaped ship definitions into engine-ready definitions with typed enums, parsed costs, and structured powers.

**Architecture:**
```
CSV (source of truth) → ShipDefinitions.engine.ts → Game Engine
```

---

## ✅ Files Created

### 1. `/game/data/ShipDefinitions.engine.ts` (NEW)

**Purpose:** Convert CSV definitions to engine-ready ShipDefinition objects

**Exports:**
- `ENGINE_SHIP_DEFINITIONS: ShipDefinition[]`
- `ENGINE_SHIP_DEFINITIONS_MAP: Record<ShipDefId, ShipDefinition>`
- `getShipDefinitionById(shipDefId)`
- `getShipById(shipDefId)` (alias)
- `getBasicShipCost(shipDefId)`
- `getUpgradedShipCost(shipDefId)`
- `getShipCost(shipDefId)`

**Key Features:**
- Maps CSV species strings ("Human") to Species.HUMAN enum
- Maps CSV shipType strings ("Basic") to ShipType.BASIC enum
- Parses component ships (handles depleted notation like "CAR(0)")
- Parses solar energy costs ("1 red energy", "X blue energy")
- Maps subphase strings to ShipPowerPhase enum
- Infers PowerTiming (continuous, once-only, upon-destruction, passive)
- Infers EffectKind from power text (heal, damage, lines, etc.)
- Applies manual overrides for ~10 key ships (CAR, ORB, SOL, INT, etc.)
- Preserves raw CSV text in power.description

---

## 🔄 Files Updated (COMPLETE ✅)

All 5 engine files have been updated to import from ShipDefinitions.engine:

1. ✅ `/game/engine/RulesEngine.tsx` (line 22)
2. ✅ `/game/engine/SpeciesIntegration.tsx` (lines 4-8)
3. ✅ `/game/engine/ActionResolver.tsx` (line 6)
4. ✅ `/game/engine/EndOfTurnResolver.tsx` (line 37)
5. ✅ `/game/engine/PowerExecutor.tsx` (line 25)

**Changed from:**
```typescript
import { getShipById } from '../data/ShipDefinitions.core';
```

**To:**
```typescript
import { getShipById } from '../data/ShipDefinitions.engine';
```

---

## 📊 Coverage Statistics

- **Total Ships:** 70
- **Manual Overrides:** 10 ships (14%) ✅
- **Auto-Detected:** ~8 ships (11%) ✅  
- **CUSTOM (pending):** ~52 ships (75%) ⚠️

**Note:** Most ships marked CUSTOM is intentional - complex logic cannot be inferred from text alone. These will be added gradually via manual overrides.

---

## ⚠️ Known Limitations

1. **~75% ships marked CUSTOM** - By design, requires gradual manual override additions
2. **AST annotations not consumed** - ShipDefinitions.annotated.ts exists but not integrated yet
3. **Max quantity limited patterns** - Only "maximum of 6/3" detected
4. **Conditional effects** - Ships like Frigate, Zenith, Defense Swarm need manual overrides

---

## ✅ Next Steps

### Immediate:
1. ✅ Update 5 engine file imports (COMPLETE)
2. ⏳ Test compilation: `npm run build`
3. ⏳ Test in dev: Create game, build ships (DEF, FIG, CAR, INT)
4. ⏳ Verify no console errors

### Short-term:
5. Add 10 more manual overrides (QUE, HIV, FRI, ZEN, ARD, etc.)
6. Test each in multiplayer
7. Add validation tests

---

## 🎯 Verification Commands

```bash
# Verify TypeScript compilation
npm run build

# Check no engine files still import .core
grep -rn "ShipDefinitions\.core" game/engine/
# Expected: No results

# Verify annotated.ts still uses .core (correct)
grep -n "ShipDefinitions\.core" game/data/ShipDefinitions.annotated.ts
# Expected: Line 30 (this is correct - it's CSV pipeline)
```

---

*End of Migration Guide*
