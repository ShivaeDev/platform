---
"@shivaedev/agent-pi": minor
---

### Breaking

- Require Pi's coding-agent SDK 1.4.0. Consumers must upgrade their `@earendil-works/pi-coding-agent` peer dependency before using this adapter release. Terminal execution events now arrive at `agent_settled`; consumers reading raw `agent_end` events must wait for settlement to determine the run outcome.

### Fixed

- Acknowledge Pi's accepted prompt dispositions, complete handled initial prompts without waiting for a run, and preserve active runs when input is handled or queued.
- Treat prompt rejection before a disposition as refusal and resolution without a disposition as uncertain acceptance.
- Report aborted settlements as interrupted while preserving final assistant failures.
