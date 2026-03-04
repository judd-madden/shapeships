/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * BATTLE INTENT TRANSLATION TEST HARNESS
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Validates the translateBattleIntentsToEffects module.
 * 
 * Tests:
 * 1. Interceptor response (damage + heal) - success case
 * 2. Invalid ship ownership - rejection case
 * 3. Deterministic ordering - sorting verification
 * 4. Unsupported modes - rejection case
 * 5. PASS intents - ignored (not rejected)
 * 
 * Run this file to validate the translation module behavior.
 */

import {
  translateBattleIntentsToEffects,
  type BattleIntent,
  type TranslationInput,
  type ShipReference,
} from './translateBattleIntentsToEffects.ts';
import { EffectKind, BattlePhase, EffectTiming, SurvivabilityRule } from '../effects/Effect.ts';

// ============================================================================
// TEST UTILITIES
// ============================================================================

function logSection(title: string): void {
  console.log('\n' + '='.repeat(80));
  console.log(title);
  console.log('='.repeat(80));
}

function logTest(testName: string): void {
  console.log(`\n📋 Test: ${testName}`);
  console.log('-'.repeat(80));
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✓ ${message}`);
}

function logSuccess(message: string): void {
  console.log(`✅ ${message}`);
}

// ============================================================================
// TEST 1: INTERCEPTOR RESPONSE (DAMAGE + HEAL)
// ============================================================================

function testInterceptorResponse(): void {
  logTest('Interceptor response — damage + heal');

  // Setup
  const playerA = 'player-a';
  const playerB = 'player-b';

  const ships: Record<string, ShipReference[]> = {
    [playerA]: [{ instanceId: 'int-a-1', shipDefId: 'INT' }],
    [playerB]: [
      { instanceId: 'int-b-1', shipDefId: 'INT' },
      { instanceId: 'int-b-2', shipDefId: 'INT' },
    ],
  };

  const intents: BattleIntent[] = [
    // Player A declares charge damage to Player B in ChargeDeclaration
    {
      kind: 'USE_CHARGE',
      declaredPhase: 'ChargeDeclaration',
      ownerPlayerId: playerA,
      shipInstanceId: 'int-a-1',
      mode: 'DAMAGE',
      target: { playerId: playerB },
    },
    // Player B responds with charge damage to Player A in ChargeResponse
    {
      kind: 'USE_CHARGE',
      declaredPhase: 'ChargeResponse',
      ownerPlayerId: playerB,
      shipInstanceId: 'int-b-1',
      mode: 'DAMAGE',
      target: { playerId: playerA },
    },
    // Player B responds with charge heal to Player B in ChargeResponse
    {
      kind: 'USE_CHARGE',
      declaredPhase: 'ChargeResponse',
      ownerPlayerId: playerB,
      shipInstanceId: 'int-b-2',
      mode: 'HEAL',
      target: { playerId: playerB },
    },
  ];

  const input: TranslationInput = {
    turnNumber: 1,
    intents,
    shipsByPlayer: ships,
  };

  // Execute
  const output = translateBattleIntentsToEffects(input);

  // Validate
  console.log('\n📊 Translation Output:');
  console.log(`  Effects: ${output.effects.length}`);
  console.log(`  Rejected: ${output.rejected.length}`);
  console.log(`  Debug Log Entries: ${output.debugLog.length}`);

  // Print debug log
  console.log('\n📝 Debug Log:');
  output.debugLog.forEach(log => console.log(`  ${log}`));

  // Assertions
  assert(output.effects.length === 3, 'Should produce 3 effects');
  assert(output.rejected.length === 0, 'Should have no rejections');

  // Validate each effect
  console.log('\n🔍 Effect Details:');
  
  output.effects.forEach((effect, i) => {
    console.log(`\nEffect ${i + 1}:`);
    console.log(`  ID: ${effect.id}`);
    console.log(`  Kind: ${effect.kind}`);
    console.log(`  Magnitude: ${effect.magnitude}`);
    console.log(`  Phase: ${effect.phase}`);
    console.log(`  Timing: ${effect.timing}`);
    console.log(`  Survivability: ${effect.survivability}`);
    console.log(`  Source: ${effect.source.type} (${effect.source.instanceId})`);
    console.log(`  Target: playerId=${effect.target.playerId}`);
    console.log(`  Owner: ${effect.ownerPlayerId}`);

    // Common assertions
    assert(effect.timing === EffectTiming.Charge, `Effect ${i + 1}: timing should be Charge`);
    assert(effect.magnitude === 5, `Effect ${i + 1}: magnitude should be 5`);
    assert(
      effect.survivability === SurvivabilityRule.ResolvesIfDestroyed,
      `Effect ${i + 1}: survivability should be ResolvesIfDestroyed`
    );
  });

  // Validate phase distribution (Path B: charges in their declared phase)
  const chargeDeclarationEffects = output.effects.filter(e => e.phase === BattlePhase.ChargeDeclaration);
  const chargeResponseEffects = output.effects.filter(e => e.phase === BattlePhase.ChargeResponse);
  const resolutionEffects = output.effects.filter(e => e.phase === BattlePhase.Resolution);
  
  assert(chargeDeclarationEffects.length === 1, 'Should have 1 ChargeDeclaration effect');
  assert(chargeResponseEffects.length === 2, 'Should have 2 ChargeResponse effects');
  assert(resolutionEffects.length === 0, 'Should have 0 Resolution effects (Path B: charges in declared phase)');

  // Validate effect 1: Player A damage to Player B (ChargeDeclaration)
  const effect1 = output.effects[0];
  assert(effect1.kind === EffectKind.Damage, 'Effect 1: should be Damage');
  assert(effect1.phase === BattlePhase.ChargeDeclaration, 'Effect 1: phase should be ChargeDeclaration');
  assert(effect1.ownerPlayerId === playerA, 'Effect 1: owner should be player A');
  assert(effect1.target.playerId === playerB, 'Effect 1: target should be player B');
  assert(effect1.source.instanceId === 'int-a-1', 'Effect 1: source should be int-a-1');

  // Validate deterministic ID
  const expectedId1 = `charge-1-${playerA}-int-a-1-damage`;
  assert(effect1.id === expectedId1, `Effect 1: ID should be ${expectedId1}, got ${effect1.id}`);

  // Validate effect 2: Player B damage to Player A (ChargeResponse, should come before heal due to sorting)
  const effect2 = output.effects[1];
  assert(effect2.kind === EffectKind.Damage, 'Effect 2: should be Damage');
  assert(effect2.phase === BattlePhase.ChargeResponse, 'Effect 2: phase should be ChargeResponse');
  assert(effect2.ownerPlayerId === playerB, 'Effect 2: owner should be player B');
  assert(effect2.target.playerId === playerA, 'Effect 2: target should be player A');
  assert(effect2.source.instanceId === 'int-b-1', 'Effect 2: source should be int-b-1');

  const expectedId2 = `charge-1-${playerB}-int-b-1-damage`;
  assert(effect2.id === expectedId2, `Effect 2: ID should be ${expectedId2}, got ${effect2.id}`);

  // Validate effect 3: Player B heal to Player B (ChargeResponse)
  const effect3 = output.effects[2];
  assert(effect3.kind === EffectKind.Heal, 'Effect 3: should be Heal');
  assert(effect3.phase === BattlePhase.ChargeResponse, 'Effect 3: phase should be ChargeResponse');
  assert(effect3.ownerPlayerId === playerB, 'Effect 3: owner should be player B');
  assert(effect3.target.playerId === playerB, 'Effect 3: target should be player B');
  assert(effect3.source.instanceId === 'int-b-2', 'Effect 3: source should be int-b-2');

  const expectedId3 = `charge-1-${playerB}-int-b-2-heal`;
  assert(effect3.id === expectedId3, `Effect 3: ID should be ${expectedId3}, got ${effect3.id}`);

  logSuccess('Interceptor response test PASSED');
}

// ============================================================================
// TEST 2: INVALID SHIP OWNERSHIP
// ============================================================================

function testInvalidShipOwnership(): void {
  logTest('Invalid ship ownership — rejection case');

  const playerA = 'player-a';
  const playerB = 'player-b';

  const ships: Record<string, ShipReference[]> = {
    [playerA]: [{ instanceId: 'int-a-1', shipDefId: 'INT' }],
    [playerB]: [{ instanceId: 'int-b-1', shipDefId: 'INT' }],
  };

  const intents: BattleIntent[] = [
    // Valid intent
    {
      kind: 'USE_CHARGE',
      declaredPhase: 'ChargeDeclaration',
      ownerPlayerId: playerA,
      shipInstanceId: 'int-a-1',
      mode: 'DAMAGE',
      target: { playerId: playerB },
    },
    // Invalid: Player A tries to use Player B's ship
    {
      kind: 'USE_CHARGE',
      declaredPhase: 'ChargeDeclaration',
      ownerPlayerId: playerA,
      shipInstanceId: 'int-b-1', // Not owned by player A
      mode: 'DAMAGE',
      target: { playerId: playerB },
    },
    // Invalid: Ship doesn't exist at all
    {
      kind: 'USE_CHARGE',
      declaredPhase: 'ChargeDeclaration',
      ownerPlayerId: playerA,
      shipInstanceId: 'non-existent-ship',
      mode: 'DAMAGE',
      target: { playerId: playerB },
    },
  ];

  const input: TranslationInput = {
    turnNumber: 1,
    intents,
    shipsByPlayer: ships,
  };

  // Execute
  const output = translateBattleIntentsToEffects(input);

  // Validate
  console.log('\n📊 Translation Output:');
  console.log(`  Effects: ${output.effects.length}`);
  console.log(`  Rejected: ${output.rejected.length}`);

  console.log('\n📝 Debug Log:');
  output.debugLog.forEach(log => console.log(`  ${log}`));

  console.log('\n❌ Rejections:');
  output.rejected.forEach(rejection => {
    console.log(`  Intent ${rejection.intentIndex}: ${rejection.reason}`);
  });

  // Assertions
  assert(output.effects.length === 1, 'Should produce 1 valid effect');
  assert(output.rejected.length === 2, 'Should reject 2 invalid intents');

  // Validate rejection indices and reasons are non-empty
  assert(
    output.rejected[0].intentIndex === 1,
    'First rejection should be for intent index 1'
  );
  assert(
    output.rejected[0].reason.length > 0,
    'First rejection should have non-empty reason'
  );

  assert(
    output.rejected[1].intentIndex === 2,
    'Second rejection should be for intent index 2'
  );
  assert(
    output.rejected[1].reason.length > 0,
    'Second rejection should have non-empty reason'
  );

  // Validate the one valid effect
  const validEffect = output.effects[0];
  assert(validEffect.ownerPlayerId === playerA, 'Valid effect should be owned by player A');
  assert(validEffect.source.instanceId === 'int-a-1', 'Valid effect should use int-a-1');

  logSuccess('Invalid ship ownership test PASSED');
}

// ============================================================================
// TEST 3: DETERMINISTIC ORDERING
// ============================================================================

function testDeterministicOrdering(): void {
  logTest('Deterministic ordering — sorting verification');

  const playerA = 'player-a';
  const playerB = 'player-b';

  const ships: Record<string, ShipReference[]> = {
    [playerA]: [
      { instanceId: 'int-a-1', shipDefId: 'INT' },
      { instanceId: 'int-a-2', shipDefId: 'INT' },
    ],
    [playerB]: [{ instanceId: 'int-b-1', shipDefId: 'INT' }],
  };

  // Intentionally create intents in scrambled order
  const intents: BattleIntent[] = [
    // ChargeResponse, Player B (should sort LAST)
    {
      kind: 'USE_CHARGE',
      declaredPhase: 'ChargeResponse',
      ownerPlayerId: playerB,
      shipInstanceId: 'int-b-1',
      mode: 'DAMAGE',
      target: { playerId: playerA },
    },
    // ChargeDeclaration, Player B (should sort THIRD)
    {
      kind: 'USE_CHARGE',
      declaredPhase: 'ChargeDeclaration',
      ownerPlayerId: playerB,
      shipInstanceId: 'int-b-1',
      mode: 'HEAL',
      target: { playerId: playerB },
    },
    // ChargeDeclaration, Player A, ship 2 (should sort SECOND)
    {
      kind: 'USE_CHARGE',
      declaredPhase: 'ChargeDeclaration',
      ownerPlayerId: playerA,
      shipInstanceId: 'int-a-2',
      mode: 'DAMAGE',
      target: { playerId: playerB },
    },
    // ChargeDeclaration, Player A, ship 1 (should sort FIRST)
    {
      kind: 'USE_CHARGE',
      declaredPhase: 'ChargeDeclaration',
      ownerPlayerId: playerA,
      shipInstanceId: 'int-a-1',
      mode: 'DAMAGE',
      target: { playerId: playerB },
    },
  ];

  const input: TranslationInput = {
    turnNumber: 1,
    intents,
    shipsByPlayer: ships,
  };

  // Execute
  const output = translateBattleIntentsToEffects(input);

  // Validate
  console.log('\n📊 Translation Output:');
  console.log(`  Effects: ${output.effects.length}`);

  console.log('\n🔍 Effect Ordering:');
  output.effects.forEach((effect, i) => {
    console.log(`  ${i + 1}. ${effect.id}`);
  });

  // Assertions: Verify sorting order
  assert(output.effects.length === 4, 'Should produce 4 effects');

  // Expected order after sorting:
  // 1. ChargeDeclaration, player-a, int-a-1, damage
  // 2. ChargeDeclaration, player-a, int-a-2, damage
  // 3. ChargeDeclaration, player-b, int-b-1, heal
  // 4. ChargeResponse, player-b, int-b-1, damage

  const expectedIds = [
    `charge-1-${playerA}-int-a-1-damage`,
    `charge-1-${playerA}-int-a-2-damage`,
    `charge-1-${playerB}-int-b-1-heal`,
    `charge-1-${playerB}-int-b-1-damage`,
  ];

  expectedIds.forEach((expectedId, i) => {
    assert(
      output.effects[i].id === expectedId,
      `Effect ${i + 1} ID should be ${expectedId}, got ${output.effects[i].id}`
    );
  });

  // Verify phase grouping
  assert(
    output.effects[0].source.instanceId === 'int-a-1' &&
    output.effects[1].source.instanceId === 'int-a-2' &&
    output.effects[2].source.instanceId === 'int-b-1',
    'ChargeDeclaration effects should come before ChargeResponse'
  );

  logSuccess('Deterministic ordering test PASSED');
}

// ============================================================================
// TEST 4: UNSUPPORTED MODES
// ============================================================================

function testUnsupportedModes(): void {
  logTest('Unsupported modes — rejection case');

  const playerA = 'player-a';
  const playerB = 'player-b';

  const ships: Record<string, ShipReference[]> = {
    [playerA]: [{ instanceId: 'int-a-1', shipDefId: 'INT' }],
  };

  const intents: BattleIntent[] = [
    // Valid DAMAGE
    {
      kind: 'USE_CHARGE',
      declaredPhase: 'ChargeDeclaration',
      ownerPlayerId: playerA,
      shipInstanceId: 'int-a-1',
      mode: 'DAMAGE',
      target: { playerId: playerB },
    },
    // Invalid: missing mode
    {
      kind: 'USE_CHARGE',
      declaredPhase: 'ChargeDeclaration',
      ownerPlayerId: playerA,
      shipInstanceId: 'int-a-1',
      // mode missing
      target: { playerId: playerB },
    } as BattleIntent,
    // Invalid: missing target
    {
      kind: 'USE_CHARGE',
      declaredPhase: 'ChargeDeclaration',
      ownerPlayerId: playerA,
      shipInstanceId: 'int-a-1',
      mode: 'DAMAGE',
      // target missing
    } as BattleIntent,
    // PASS intent (should be ignored, not rejected)
    {
      kind: 'PASS',
      declaredPhase: 'ChargeDeclaration',
      ownerPlayerId: playerA,
    },
  ];

  const input: TranslationInput = {
    turnNumber: 1,
    intents,
    shipsByPlayer: ships,
  };

  // Execute
  const output = translateBattleIntentsToEffects(input);

  // Validate
  console.log('\n📊 Translation Output:');
  console.log(`  Effects: ${output.effects.length}`);
  console.log(`  Rejected: ${output.rejected.length}`);

  console.log('\n📝 Debug Log:');
  output.debugLog.forEach(log => console.log(`  ${log}`));

  console.log('\n❌ Rejections:');
  output.rejected.forEach(rejection => {
    console.log(`  Intent ${rejection.intentIndex}: ${rejection.reason}`);
  });

  // Assertions
  assert(output.effects.length === 1, 'Should produce 1 valid effect');
  assert(output.rejected.length === 2, 'Should reject 2 invalid intents (PASS is ignored, not rejected)');

  // Validate rejection reasons
  assert(
    output.rejected[0].reason.includes('missing mode'),
    'First rejection should mention missing mode'
  );

  assert(
    output.rejected[1].reason.includes('missing target'),
    'Second rejection should mention missing target'
  );

  logSuccess('Unsupported modes test PASSED');
}

// ============================================================================
// TEST 5: PASS INTENTS
// ============================================================================

function testPassIntents(): void {
  logTest('PASS intents — ignored (not rejected)');

  const playerA = 'player-a';

  const ships: Record<string, ShipReference[]> = {
    [playerA]: [{ instanceId: 'int-a-1', shipDefId: 'INT' }],
  };

  const intents: BattleIntent[] = [
    {
      kind: 'PASS',
      declaredPhase: 'ChargeDeclaration',
      ownerPlayerId: playerA,
    },
    {
      kind: 'PASS',
      declaredPhase: 'ChargeResponse',
      ownerPlayerId: playerA,
    },
  ];

  const input: TranslationInput = {
    turnNumber: 1,
    intents,
    shipsByPlayer: ships,
  };

  // Execute
  const output = translateBattleIntentsToEffects(input);

  // Validate
  console.log('\n📊 Translation Output:');
  console.log(`  Effects: ${output.effects.length}`);
  console.log(`  Rejected: ${output.rejected.length}`);

  console.log('\n📝 Debug Log:');
  output.debugLog.forEach(log => console.log(`  ${log}`));

  // Assertions
  assert(output.effects.length === 0, 'PASS intents should produce no effects');
  assert(output.rejected.length === 0, 'PASS intents should not be rejected');

  logSuccess('PASS intents test PASSED');
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

function runAllTests(): void {
  logSection('🧪 BATTLE INTENT TRANSLATION TEST HARNESS');

  console.log('\nRunning comprehensive tests for translateBattleIntentsToEffects module...\n');

  try {
    testInterceptorResponse();
    testInvalidShipOwnership();
    testDeterministicOrdering();
    testUnsupportedModes();
    testPassIntents();

    logSection('✅ ALL TESTS PASSED');
    console.log('\nTranslation module is working correctly!');
    console.log('Ready for integration with IntentReducer and BattleReducer.\n');
  } catch (error) {
    logSection('❌ TEST SUITE FAILED');
    console.error('\nError:', error);
    throw error;
  }
}

// Run tests if this file is executed directly
if (import.meta.main) {
  runAllTests();
}

// Export for potential integration into larger test suite
export { runAllTests };