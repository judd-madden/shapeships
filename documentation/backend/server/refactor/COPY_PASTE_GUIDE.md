# Exact Copy-Paste Instructions

## Task 1: Complete send-action in game_routes.ts

### Source File: `/supabase/functions/server/index.tsx`
### Target File: `/supabase/functions/server/routes/game_routes.ts`

**Find in game_routes.ts (line ~473):**
```typescript
app.post("/make-server-825e19ab/send-action/:gameId", async (c) => {
  // Placeholder to maintain structure - FULL CODE WOULD GO HERE
```

**Replace entire handler body with lines 1862-2424 from original index.tsx**

**Start copying at line 1862:**
```typescript
  try {
    // Validate session token and get server-side identity
```

**Stop copying at line 2424:**
```typescript
  }
});
```

**Paste location:** Replace lines 473-514 in game_routes.ts (the placeholder handler)

---

## Task 2: Complete Helper Functions in intent_routes.ts

### Source File: `/supabase/functions/server/index.tsx`
### Target File: `/supabase/functions/server/routes/intent_routes.ts`

### 2A: validateIntentStructure
**Copy from index.tsx lines 2715-2751**
**Paste into intent_routes.ts replacing the TODO at line ~50**

### 2B: updateChessClock
**Copy from index.tsx lines 2758-2816**
**Paste into intent_routes.ts replacing the TODO at line ~60**

### 2C: createClockEvent
**Copy from index.tsx lines 2819-2834**
**Paste into intent_routes.ts replacing the TODO at line ~70**

### 2D: sha256
Already has stub - **optionally copy full implementation from lines 2837-2843**

### 2E: validateRevealHash
Already has stub - **optionally copy full implementation from lines 2845-2849**

### 2F: getCommitments
Already has stub - **optionally copy full implementation from lines 2852-2857**

### 2G: storeCommitment  
Already has stub - **optionally copy full implementation from lines 2860-2873**

### 2H: getCommitment
Already has stub - **optionally copy full implementation from lines 2876-2880**

---

## Task 3: Complete Intent Endpoint Body

### Source File: `/supabase/functions/server/index.tsx`
### Target File: `/supabase/functions/server/routes/intent_routes.ts`

**Find in intent_routes.ts (line ~140):**
```typescript
// TODO: PASTE FULL INTENT PROCESSING LOGIC HERE
```

**Copy from index.tsx lines 2929-3420**

**Start copying at line 2929:**
```typescript
    // 2. Load canonical game state
    const gameStateKey = `game:${intent.gameId}:state`;
```

**Stop copying at line 3420:**
```typescript
    return c.json(response);
```

**Paste location:** Replace the TODO section in intent_routes.ts (around lines 140-160)

---

## Task 4: Activate New Index File

### Terminal Commands:
```bash
cd /supabase/functions/server/

# Backup original
mv index.tsx index_OLD_BACKUP.tsx

# Activate new file
mv index_NEW.tsx index.tsx
```

---

## Quick Reference Table

| Task | Source File | Source Lines | Target File | Target Location |
|------|-------------|--------------|-------------|-----------------|
| send-action body | index.tsx | 1862-2424 | game_routes.ts | Line ~473 |
| validateIntentStructure | index.tsx | 2715-2751 | intent_routes.ts | Line ~50 |
| updateChessClock | index.tsx | 2758-2816 | intent_routes.ts | Line ~60 |
| createClockEvent | index.tsx | 2819-2834 | intent_routes.ts | Line ~70 |
| Intent handler body | index.tsx | 2929-3420 | intent_routes.ts | Line ~140 |

---

## Verification Checksums

After completing all tasks, your files should have approximately these line counts:

- `/routes/auth_routes.ts`: 103 lines ✓
- `/routes/test_routes.ts`: 192 lines ✓
- `/routes/game_routes.ts`: ~1,050 lines (after send-action)
- `/routes/intent_routes.ts`: ~650 lines (after intent)
- `/legacy/legacy_rules.ts`: 1,193 lines ✓
- `/index.tsx`: 237 lines (after activation)

**Total:** ~3,425 lines (same as original, just reorganized)
