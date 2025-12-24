# Ship Engine Coverage Status

**As of:** 2024-12-24  
**Total Ships:** 70  
**Manual Overrides:** 10 ships  
**Auto-Detected:** ~8 ships  
**CUSTOM (needs work):** ~52 ships

---

## ✅ Ships with Manual Overrides (10)

These ships have hand-tuned power definitions with correct effectType, specialLogic, and requirements.

### Human Species
1. **INT (Interceptor)**
   - Power 0: HEAL (5) with charge
   - Power 1: DAMAGE (5) with charge
   - Status: ✅ Complete

2. **CAR (Carrier)**
   - Power 0: BUILD_SHIP (DEF) - 1 charge
   - Power 1: BUILD_SHIP (FIG) - 2 charges
   - Status: ✅ Complete

3. **ORB (Orbital)**
   - Power 0: GAIN_LINES (1) - persistent future turns
   - Status: ✅ Complete

4. **COM (Commander)**
   - Power 0: COUNT_AND_DAMAGE - count FIG, every 3
   - Status: ✅ Complete

5. **BAT (Battle Cruiser)**
   - Power 0: GAIN_LINES (2)
   - Power 1: HEAL (3)
   - Power 2: DAMAGE (2)
   - Status: ✅ Complete

### Ancient Species
6. **SOL (Solar Grid)**
   - Power 0: GAIN_ENERGY (red+green) - 1 charge
   - Power 1: GAIN_ENERGY (blue) - 2 charges
   - Status: ✅ Complete

7. **CUB (Cube)**
   - Power 0: CUSTOM - repeat solar power
   - Status: ⚠️ Stub (needs engine hook)

8. **SSIM (Simulacrum)**
   - Power 0: COPY_SHIP - variable energy cost
   - Status: ⚠️ Stub (needs engine hook)

---

## ✅ Ships Auto-Detected (8)

These ships have simple patterns that the inference engine can detect automatically.

### Human Species
1. **DEF (Defender)** - "Heal 1" → HEAL (1)
2. **FIG (Fighter)** - "Deal 1 damage" → DAMAGE (1)

### Other Species
3-8. *(Ships with simple heal/damage patterns)*

**Note:** Auto-detection works for:
- "Heal N" → HEAL
- "Deal N damage" → DAMAGE
- "Generate N additional line(s)" → GAIN_LINES
- Basic "Make a [ShipName]" → BUILD_SHIP

---

## ⚠️ Ships Needing Manual Overrides (~52)

These ships are marked `effectType: CUSTOM` and need manual override entries.

### Priority 1: High-Value Ships (10)

**Reasoning:** Core gameplay mechanics, frequently used

1. **QUE (Queen)** - Count-based healing with exclusions
2. **HIV (Hive)** - Component ship counting
3. **FRI (Frigate)** - Player choice trigger number
4. **ZEN (Zenith)** - Dice-based conditional builds
5. **DSW (Defense Swarm)** - Health comparison
6. **ARD (Ark of Redemption)** - Set health to max
7. **ARK (Ark of Domination)** - Steal ships
8. **ARN (Ark of Knowledge)** - Equalize highest
9. **ARP (Ark of Power)** - Conditional line generation
10. **SCI (Science Vessel)** - Dice multiplier + ship count scaling

### Priority 2: Xenite Ships (15)
**Status:** Most marked CUSTOM

### Priority 3: Centaur Ships (15)
**Status:** Most marked CUSTOM

### Priority 4: Ancient Solar Powers (12)
**Status:** Most marked CUSTOM

---

## 📊 Coverage Statistics

| Category | Count | Percentage |
|----------|-------|------------|
| **Manual Overrides** | 10 | 14% |
| **Auto-Detected** | ~8 | 11% |
| **CUSTOM (pending)** | ~52 | 75% |
| **Total Ships** | 70 | 100% |

---

## 🎯 Roadmap to 100% Coverage

### Sprint 1 (Weeks 1-2): Priority 1 Ships
Add 10 high-value ship overrides

**Target:** 20 ships fully covered (28%)

### Sprint 2 (Weeks 3-4): Xenite Ships
Add 15 Xenite ship overrides

**Target:** 35 ships fully covered (50%)

### Sprint 3 (Weeks 5-6): Centaur Ships
Add 15 Centaur ship overrides

**Target:** 50 ships fully covered (71%)

### Sprint 4 (Weeks 7-8): Remaining Ships
Add all remaining overrides + validation

**Target:** 70 ships fully covered (100%)

---

## 📝 Template for Adding New Override

```typescript
// In MANUAL_POWER_OVERRIDES object in ShipDefinitions.engine.ts:

'SHIP_ID': {
  0: {  // Power index
    effectType: EffectKind.EFFECT_TYPE,
    baseAmount: NUMBER,  // if applicable
    requiresCharge: true,  // if applicable
    specialLogic: {
      // Add relevant fields:
      countType: 'specific_ship_type',
      countTarget: 'TARGET_SHIP_ID',
      countMultiplier: NUMBER,
      // ... other fields as needed
    }
  }
}
```

---

*End of Coverage Status*
