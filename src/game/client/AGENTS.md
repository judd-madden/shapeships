\# Client Runtime Agent Rules



This directory contains the client runtime for Shapeships.



Architecture context:

\- ../../documentation/contracts/canonical-handoff.md

\- ../../documentation/contracts/code-ownership-map.md

\- ../../AGENTS.md (repo root)



---



\## Responsibilities



Client runtime code handles:



\- session lifecycle

\- server communication

\- view model generation

\- orchestration of UI state



Networking should remain centralized in this layer.



---



\## Authority Rules



The client is \*\*not authoritative\*\*.



Client code may:



\- render server state

\- send intents to the server

\- compute previews



Client code must not:



\- resolve combat

\- determine rule legality

\- mutate canonical game state



If server and client disagree, the server wins.



---



\## Relationship to Display Layer



Client runtime feeds data to:



\- `game/display/\*\*`

\- `components/\*\*`

\- `graphics/\*\*`



Display components should remain presentation-only.



Avoid moving networking into display components.



---



\## Editing Rules



Agents should:



\- modify view-model logic here rather than inside UI components

\- keep networking centralized

\- prefer small, targeted edits

\- preserve existing data flow patterns



---



\## Forbidden Changes (Without Explicit Approval)



Do not:



\- implement gameplay rules here

\- move authoritative logic from the server

\- introduce new networking entry points in UI components

\- modify build/tooling configuration



---



\## Validation



After edits run:



\- npm run typecheck

\- npm run build (if needed)



Report:



\- files modified

\- view-model changes

\- validation results



---



\## When Unsure



1\. keep rule logic on the server

2\. keep networking centralized

3\. keep UI components presentation-focused

