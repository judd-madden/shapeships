# EQU first-target investigation and cleanup

24 October 2026. The cleanup is a Tooling Pass; the existing production fix and
three regression sources are preserved. No deployment or live-game retest.

## Diagnosis and retained fix

Actual React 18.3.1 rendering of the captured Turn 4 session reproduced an update
depth loop after selecting either own WIS or opponent COM as EQU's first target.
Equivalent target-draft reconciliations were dispatched before their updater's
equality check. Pending lower-priority work could cause React to replay the
first-target updater, allocate equivalent draft objects, and commit repeatedly.
Layout-time stats synchronization participated by dispatching unchanged state;
the stats contents did not oscillate. Controlled failing traces recorded 52
post-trigger commits and zero changed stats-updater results.

The retained fix in `src/game/client/gameSession/destroyTargeting.ts` compares
`destroyTargetDraft` with `reconciledDraft` before dispatch and returns when equal.
The effect includes `destroyTargetDraft` in its dependencies and retains the
functional updater's equality check. Real stale-target reconciliation still runs.
This changes client-local synchronization, not authoritative gameplay rules.
The experimental stats-only guard is not the production fix.

Preserved regression sources under `src/game/client/tests/gameSession/`:

- `equFirstTargetLifecycle_test.ts`: opt-in actual-React session regression harness.
- `fixtures/equFirstTargetReplay.ts`: read-only capture loader and offline replay.
- `helpers/equFirstTargetDiagnostics.ts`: bounded diagnostics and source transforms.

Original snapshots and crash captures remain outside the checkout at
`C:\Design\Shapeships\gpt-snapshots\`, including the original console log, HAR,
and Turn 4 game state under `crash/`. Cleanup does not access or change originals.

## Prior validation preserved before artifact removal

These are results from the saved investigation reports and result files, not
fresh browser runs during cleanup:

- Original checkout source: all four original regressions failed in both Edge
  and Firefox. The same failure was reproduced in three extracted source snapshots.
- Fixed checkout: 48 controlled production-session cases passed across Edge and
  Firefox, mobile, desktop, Strict Mode with reduced motion, and Turn 4 progression.
  This includes 16 stale-target refresh cases. The saved matrix records zero
  runtime errors, 6-10 post-target commits, and at most 46 render invocations.
- Both experimental guard environment values were absent; traces identified the
  checkout as their source. Eight separate synthetic probes passed their expected
  failure assertions; they intentionally retain the original dispatch pattern.
- Eight additional native mouse-input controls passed across the two browsers.
- The saved ordinary-test result records 275 passing tests and zero failures.
  Typecheck, build, and diff whitespace checks passed; build warned about chunk size.

The controlled scheduling overlap is an experiment, not historical click timing
recovered from the HAR. Browser coverage uses development React rather than a
minified-bundle end-to-end test. The capture has no successful completed-EQU
preview or intent response, so successful server submission is not established.
Firefox uses a mobile viewport without touch-device emulation. An initial Firefox
matrix attempt had startup/WebSocket failures with long disposable profile paths;
subsequent serial runs with shorter labels passed. A human live-game retest remains.

## Cleanup and localhost evidence

Before cleanup, Git reported 32,593 changed files: one tracked production edit,
zero staged changes, and 32,592 untracked files. The generated investigation tree
accounted for 32,589: 30,109 profile files, 2,042 extracted snapshot files, and 438
root-level artifacts. No `tmp/` files were tracked. There were also 12 ignored logs.
Git warned about long Windows paths without command-local long-path support.

Cleanup removed only the investigation's `profiles/`, `snapshots/`, and 450
root-level generated files under `tmp/maximum-update-depth/`. Full filesystem
enumeration counted 33,206 files, 7,764 directories, and 4,149,652,843 bytes removed,
including files ignored by Git. All targets were checked inside the resolved
checkout; preflight rejected symbolic links and unexpected entries before deletion.
The investigation directory remains empty. This summary was saved before deletion.
The added root ignore rule `/tmp/maximum-update-depth/` prevents regenerated
artifacts from flooding Git. No dependency, lockfile, or build configuration changed;
no index changes were necessary.

Process inspection found no investigation-owned browser/test process. An initially
observed Vite process on `::1:3000` originated from a VS Code terminal and exited
without intervention. HTTP probes failed to connect; subsequent checks found no
listener on ports 3000, 3001, 4173, or 5173 and no remaining Node/Vite process.
No process was stopped by this pass.

The installed Tailwind Vite plugin scans from the project root, so generated trees
are a plausible source of scanning load. Neither scanning nor a persistent port
conflict has been established as the localhost failure's cause. No new Vite server
or browser automation is started during cleanup.

Retry from the repository root with `npm run dev`. If startup still fails, retain
the complete terminal output from invocation through the error or Vite ready
banner, including its displayed URL. For a hang, include elapsed time and the last
printed line. If Vite becomes ready, include the browser's exact error and URL.

## Fresh cleanup validation

Run after artifact removal, with `EQU_BROWSER_REPLAY=0` for all three npm commands:

- `npm run test:client`: passed; 50 files and 749 tests passed. The opt-in browser
  suite was skipped (one file, seven tests); no browser replay was run.
- `npm run typecheck`: passed.
- `npm run build`: passed; 454 modules transformed, with the large-chunk warning.
- SHA-256 comparisons: the production fix and all three regression sources match
  their pre-cleanup baselines byte-for-byte. The production diff retains exactly
  its three added lines, including the guard and effect dependency.
- `git diff --check`: passed. Git reports the existing LF-to-CRLF advisory for
  `destroyTargeting.ts`; cleanup did not rewrite that file.
- The narrow ignore rule matches both root artifacts and nested regenerated files.
  No generated files remain in the investigation directory.
- Final Git status: six changes, comprising two tracked modifications and four
  untracked files, with nothing staged. These are the existing production fix,
  three regression sources, `.gitignore`, and this summary.
- Final process/port inspection: no investigation-owned process, Node/Vite process,
  or listener on ports 3000, 3001, 4173, or 5173. No process was stopped.

Dependencies, lockfiles, and configuration remain unchanged. No server or browser
was started and nothing was deployed. The successful build does not establish that
the user's development-server startup problem is resolved; manual restart and the
live-game retest remain with the user.
