# Files to Remove from Active Codebase

**Date:** 2026-01-07  
**Reason:** Migration from CSV to JSON ship data system

## Instructions

The following files are no longer used and should be removed from the active codebase:

### 1. CSV Source File
```bash
rm /game/data/source/GEN2_SHIP_TABLE_1.2.csv
rm -d /game/data/source  # Remove empty directory
```

### 2. Generator Scripts
```bash
rm /scripts/generateShipDefinitionsFromCsv.ts
rm /scripts/testShipDrift.ts
```

### 3. Documentation
```bash
rm /documentation/CSV_SINGLE_SOURCE_OF_TRUTH.md
```

### 4. Package.json Scripts (if present)
Remove these npm scripts from `package.json`:
- `gen:ships`
- `test:drift`

## Verification

After removal, verify:

```bash
# Ensure no imports reference deleted files
grep -r "generateShipDefinitionsFromCsv" .
grep -r "GEN2_SHIP_TABLE" .
grep -r "testShipDrift" .

# Should find ZERO matches in runtime code
# (May find matches in this archive documentation)
```

## Alternative: Archive Instead of Delete

If you prefer to keep these files for historical reference:

```bash
# Move instead of delete
mv /game/data/source/GEN2_SHIP_TABLE_1.2.csv /documentation/archive/ship-data/
mv /scripts/generateShipDefinitionsFromCsv.ts /documentation/archive/ship-data/
mv /scripts/testShipDrift.ts /documentation/archive/ship-data/
mv /documentation/CSV_SINGLE_SOURCE_OF_TRUTH.md /documentation/archive/ship-data/
```

## Post-Migration Checklist

- [  ] CSV file removed or archived
- [ ] Generator scripts removed or archived
- [ ] Legacy documentation removed or archived
- [ ] Package.json scripts removed (if applicable)
- [ ] No import errors in codebase
- [ ] App builds successfully
- [ ] Ship data loads from JSON source
- [ ] All 79 ships display correctly
- [ ] Power text renders with newlines (UI interprets `\n`)

## Rollback Plan (Emergency Only)

If critical issues arise:

1. Restore archived files
2. Revert ShipDefinitions.core.ts to CSV version
3. Revert ShipDefinitions.json.ts creation
4. Run `npm run gen:ships`
5. Document the blocker preventing JSON migration

**Note:** Rollback should only be needed if fundamental type incompatibilities are discovered.
