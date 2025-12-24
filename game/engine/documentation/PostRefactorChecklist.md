# Post-Refactor Verification Checklist

**Date:** 2024-12-24  
**Purpose:** Verify engine refactor completion and game functionality

---

## ✅ Code Verification

### Import Checks
- [x] No imports from `ShipTypes.core.ts` (file deleted)
- [x] All engine files use `ShipTypes.engine.ts`
- [x] All effect references use `EffectKind` (not PowerEffectType)
- [x] No `SpecialLogic.executeCustomLogic()` calls (except definition)

### Architecture Checks
- [x] PowerExecutor delegates to PowerResolver
- [x] EndOfTurnResolver uses PowerResolver for continuous effects
- [x] PassiveModifiers only queries (no execution)
- [x] SpecialLogic is deprecated stub
- [x] ManualPowerOverrides has ship-specific logic

### File Status
- [x] PowerExecutor.tsx - Refactored to orchestrator
- [x] EndOfTurnResolver.tsx - Refactored to effect applicator
- [x] PassiveModifiers.tsx - Imports updated, validated
- [x] SpecialLogic.tsx - Deprecated
- [x] PowerResolver.ts - Created
- [x] ManualPowerOverrides.ts - Created

---

## 🧪 Functional Testing

### Basic Ship Powers (Kind-Based)

**Defender (DEF) - Heal 1**
- [ ] Power executes during Automatic phase
- [ ] Effect enqueued (not applied immediately)
- [ ] Health changes at end-of-turn
- [ ] Correct amount (+1 health)

**Fighter (FIG) - Damage 1**
- [ ] Power executes during Automatic phase
- [ ] Effect enqueued (not applied immediately)
- [ ] Damage applied at end-of-turn
- [ ] Correct amount (-1 opponent health)

**Orbital (ORB) - Lines 1/turn**
- [ ] Power executes during Line Generation
- [ ] Lines applied immediately (not enqueued)
- [ ] Correct amount (+1 line)
- [ ] Persists across future turns

### Manual Override Ships

**Frigate (FRI) - Trigger Number**
- [ ] Player can choose trigger number (1-6)
- [ ] Damage only when dice matches
- [ ] Correct amount (6 damage)
- [ ] NO-OP when dice doesn't match

**Defense Swarm (DSW) - Conditional Heal**
- [ ] Heals 3 normally
- [ ] Heals 7 when health < opponent
- [ ] Effect enqueued for end-of-turn
- [ ] Correct conditional logic

**Science Vessel (SCI) - Scaling**
- [ ] Count-based effects work
- [ ] 1 SCI: doubles automatic healing
- [ ] 2 SCI: doubles automatic damage
- [ ] 3 SCI: +dice lines
- [ ] Handled by PassiveModifiers

### NO-OP Ships (CSV-Only)

**Ships without kind or override:**
- [ ] Game doesn't crash
- [ ] Warning logged in console
- [ ] Ship exists on board
- [ ] Other ships still work
- [ ] Game remains playable

---

## 🎮 Game Flow Testing

### Build Phase
- [ ] Line Generation executes
- [ ] Ships That Build executes
- [ ] Drawing executes
- [ ] End of Build Phase executes
- [ ] Powers execute in correct order
- [ ] Resources update correctly

### Battle Phase
- [ ] First Strike executes
- [ ] Simultaneous Declaration executes
- [ ] Conditional Response executes
- [ ] Effects enqueued (not applied yet)
- [ ] Player choices work

### End of Turn
- [ ] Continuous effects evaluated
- [ ] Triggered effects collected
- [ ] All effects applied simultaneously
- [ ] Health capped at max
- [ ] Victory check runs
- [ ] Turn transitions correctly

---

## 🔧 Integration Testing

### Charge System
- [ ] Charges spent correctly (CAR, INT, SOL)
- [ ] Powers require correct charge amount
- [ ] Insufficient charges = NO-OP
- [ ] Charge depletion tracked
- [ ] Graphics update with charges

### Once-Only Powers
- [ ] Executes first turn only
- [ ] Tracked correctly
- [ ] Doesn't execute again
- [ ] Persists even if ship destroyed

### Passive Modifiers
- [ ] Registered on ship build
- [ ] Removed on ship destroy
- [ ] Query methods work
- [ ] Count methods accurate
- [ ] Legality checks work

### Player Choices
- [ ] Destroy ship choice works
- [ ] Steal ship choice works
- [ ] Copy ship choice works
- [ ] Build ship choice works
- [ ] Choice UI appears
- [ ] Choice state preserved

---

## 🌐 Multiplayer Testing

### State Synchronization
- [ ] Both players see same state
- [ ] Effects apply to both clients
- [ ] Turn phases sync
- [ ] Ready states work
- [ ] No desync errors

### Network Resilience
- [ ] Handles disconnection
- [ ] Reconnection works
- [ ] State recovers correctly
- [ ] No data loss
- [ ] Polling continues

---

## 📊 Performance Testing

### Resolution Performance
- [ ] PowerResolver doesn't lag
- [ ] EndOfTurnResolver completes quickly
- [ ] Large ship counts handled
- [ ] No memory leaks
- [ ] Console clean (no spam)

### Dev Warnings
- [ ] NO-OP warnings logged (expected)
- [ ] No error messages
- [ ] Helpful warning messages
- [ ] Warnings include ship ID + power index

---

## 🐛 Edge Cases

### Empty States
- [ ] No ships = no crashes
- [ ] No effects = resolution works
- [ ] Empty turn data handled
- [ ] Missing game data handled

### Extreme Values
- [ ] 0 health handled
- [ ] Negative health capped
- [ ] Max health changes work
- [ ] Large damage/healing values
- [ ] Many ships (50+)

### Timing Edge Cases
- [ ] Ship destroyed mid-turn
- [ ] Ship built mid-turn
- [ ] Charge depletion mid-turn
- [ ] Player surrender
- [ ] Game end mid-phase

---

## 📝 Documentation Verification

### Documentation Complete
- [x] PowerResolutionArchitecture.md exists
- [x] EngineRefactorProgress.md exists
- [x] RefactorCompletionSummary.md exists
- [x] PostRefactorChecklist.md exists (this file)

### Documentation Accurate
- [ ] Architecture diagrams match code
- [ ] Examples are correct
- [ ] Migration paths clear
- [ ] API references accurate
- [ ] No outdated information

---

## 🔍 Code Quality

### Type Safety
- [x] No `any` types in engine
- [x] All imports typed
- [x] Function signatures complete
- [x] Enums used correctly
- [x] Optional fields marked

### Error Handling
- [x] Missing ship definitions handled
- [x] Invalid power indices handled
- [x] Null/undefined checks
- [x] Try-catch where needed
- [x] Helpful error messages

### Code Cleanliness
- [x] No commented-out code
- [x] No unused imports
- [x] No duplicate logic
- [x] Consistent naming
- [x] Clear function purposes

---

## ✅ Deployment Readiness

### Pre-Deployment
- [ ] All tests passing
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Documentation reviewed
- [ ] Code reviewed

### Deployment Steps
1. [ ] Commit changes with clear message
2. [ ] Tag version (e.g., v2.0-engine-refactor)
3. [ ] Deploy to staging
4. [ ] Test in staging environment
5. [ ] Monitor for issues
6. [ ] Deploy to production

### Post-Deployment
- [ ] Monitor error logs
- [ ] Check player feedback
- [ ] Watch for edge cases
- [ ] Update documentation if needed
- [ ] Plan next improvements

---

## 🎯 Success Criteria

### Must Have (Blockers)
- [ ] Game is playable
- [ ] No crashes
- [ ] Basic ships work
- [ ] Manual override ships work
- [ ] Multiplayer syncs
- [ ] Victory conditions work

### Should Have (Important)
- [ ] NO-OP graceful degradation
- [ ] All phase transitions smooth
- [ ] Charge system working
- [ ] Passive modifiers active
- [ ] Performance good

### Nice to Have (Polish)
- [ ] All ships with structure
- [ ] No warnings in console
- [ ] Perfect test coverage
- [ ] Advanced features working

---

## 📅 Testing Timeline

**Day 1: Core Functionality**
- Test basic ship powers
- Test manual override ships
- Test NO-OP ships
- Test game flow

**Day 2: Integration**
- Test charge system
- Test passive modifiers
- Test player choices
- Test multiplayer

**Day 3: Polish**
- Edge case testing
- Performance testing
- Documentation review
- Bug fixing

---

## 🐛 Known Issues

### To Document
- [ ] List any known limitations
- [ ] Document workarounds
- [ ] Plan fixes for next iteration

### To Fix Before Deploy
- [ ] Critical bugs
- [ ] Blocking issues
- [ ] Security concerns

### Can Fix Later
- [ ] Minor bugs
- [ ] Polish items
- [ ] Enhancement requests

---

## 📞 Contact & Support

**Questions?**
- See `/game/engine/documentation/PowerResolutionArchitecture.md`

**Issues Found?**
- Check PowerResolver.ts
- Check ManualPowerOverrides.ts
- Check EffectTypes.ts

**Need Help?**
- Review documentation
- Check code comments
- Search for similar patterns

---

**Checklist Created:** 2024-12-24  
**Status:** Ready for testing  
**Next Action:** Begin functional testing phase
