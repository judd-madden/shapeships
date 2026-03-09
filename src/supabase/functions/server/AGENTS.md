\# Server Engine Agent Rules



This directory contains the authoritative Shapeships game engine.



Architecture context:

\- ../../../documentation/contracts/canonical-handoff.md

\- ../../../documentation/contracts/code-ownership-map.md

\- ../../../AGENTS.md (repo root)



If rules conflict, canonical-handoff.md wins.



---



\## Authority



This layer is authoritative.



The server determines:

\- rule legality

\- turn resolution

\- phase progression

\- combat outcomes

\- effect application

\- canonical game state



Client and UI code must defer to server outcomes.



---



\## Responsibilities



Code in this directory may:



\- validate player intents

\- apply game rules

\- mutate canonical game state

\- resolve combat and effects

\- advance phases and turns



---



\## Determinism



Server logic must remain deterministic.



Requirements:



\- identical inputs → identical outcomes

\- randomness must be explicit

\- game state transitions must be replayable



Avoid hidden side effects.



---



\## Editing Rules



Agents should:



\- keep edits surgical

\- preserve existing architecture

\- reuse existing helpers when possible

\- inspect nearby files before implementing new logic



Do not rewrite large files unnecessarily.



---



\## Forbidden Changes (Without Explicit Approval)



Do not:



\- move authoritative logic into the client

\- introduce UI or rendering code

\- introduce React or browser dependencies

\- modify build/tooling configuration

\- create new architectural layers



---



\## Typical Validation



After server edits run:



\- deno check src/supabase/functions/server/index.tsx

\- deno task check (if available)



Report:

\- files changed

\- rule behavior changes

\- validation results



---



\## When Unsure



If architectural uncertainty exists:



1\. preserve server authority

2\. prefer smaller changes

3\. reuse existing rule patterns

4\. consult canonical-handoff.md

