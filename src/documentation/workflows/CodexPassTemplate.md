# Codex Pass Template

Use this template when defining a pass for Codex or another repo-attached coding agent.

## Pass Header
- **Pass type:** Server Pass / Client-UI Pass / Tooling Pass / Mixed Pass
- **Goal:** one sentence
- **Why now:** short context
- **Primary layer:** server / client-runtime / display / tooling

## Scope
### Allowed files / folders
- list exact folders or files

### Out of scope
- list what must not be touched

## Constraints
- preserve architecture from `contracts/canonical-handoff.md`
- respect ownership from `contracts/code-ownership-map.md`
- keep changes surgical
- do not rewrite whole files without justification
- do not expand the pass silently

## Validation
List the checks expected for this pass, for example:
- `npm run typecheck`
- `npm run build`
- `deno check src/supabase/functions/server/index.tsx`
- `deno task check`

## Output format required from the agent
1. file plan before editing
2. changed files list after editing
3. concise summary of what changed
4. validation results
5. unresolved risks or assumptions

## Example prompt skeleton

```text
Pass type: Client-UI Pass

Goal:
Update the relevant view-model and panel wiring for X without changing authoritative server rules.

Allowed scope:
- src/game/client/**
- src/game/display/**

Out of scope:
- src/supabase/functions/server/**
- config files

Constraints:
- preserve server authority
- keep networking in client runtime
- do not add rule logic to display code
- prefer surgical edits

Validation:
- npm run typecheck
- npm run build

Output:
- show file plan first
- then implement
- then summarize changed files and validation
```
