# Changelog

## Unreleased

- Breaking: replace `FleetViews.needsHuman` with `waiting.maintainer`, `waiting.orchestrator` and `waiting.automation`. Persist `attentionOwner` on waiting records; group status and generated Board views by owner and name the owner in wait/watch output. Stage values and wait exit codes are unchanged.
- Route worker questions to the orchestrator by default; require `FLEET_MAINTAINER_QUESTION:` for explicit maintainer escalation. Add Fleet, RPC and CLI reassignment with durable supersession of the prior question. Recover legacy question publication before assigning its new owner.

- Follow multiple items with `work-fleet watch [ids...]`, emitting one line per completed, needs-human or released item. With no IDs, follow the active items at startup. Watch and wait read only summary fields in one PostgreSQL query per poll; wait retains its exit codes.
- Generate `fleet/status.md` from the CLI host's Fleet views, with Active, Needs human and Done heading columns, task and adopted PR links, and live Work Board updates. Preserve authored sources and retry failed publication without changing execution outcomes.
- Publish stopped worker questions through Board and continue the same thread with the recorded answer, using a durable submission intent to prevent repeated continuation after concurrent resolution, restart or a lost acknowledgement.
- Read GitHub check runs and commit statuses for the adopted PR's exact SHA, retain
  pending checks in validation and send failed check names and links to repair.


- Add `fleet-deliverable: report`: workers return the whole report in their final message, and Fleet records an immutable Board result with the task relationship and exact session/turn receipt. Reports complete without PR adoption, review, checks or delivery; empty output needs a human. Publication retries reuse the same result identity.
- Add the `work-fleet` command: `run` schedules approved Board work, `dispatch`
  launches one item, `status` lists active, done and needs-human work, and `wait`
  blocks on one item and exits with its outcome. Host settings come from a
  `fleet.config.json` in the Board folder.
- Approve Board work with `fleet: approved` frontmatter on the exact revision read.
- Launch Codex Cloud workers through a hosted provider with model, reasoning effort
  and service tier from host config, overridable per item, and read their final output.
- Build Cloud worker prompts from one template with a startup block and a parseable
  `FLEET_PR:` report line.
- Require Cloud worker prompts to watch CI after every push, repair failures on the same branch, merge current main when behind or conflicted, and report the exact head's CI result before the PR marker, with a reason when blocked.
- Remove owned-path overlap blocking; overlapping work runs and Git resolves conflicts.
- Dispatch prepared work concurrently.

- Add the optional Board-backed Fleet core with PostgreSQL attempt attachments,
  transactional reservations, session/turn receipts and native command/query contracts.
- Carry approved work through independent revision-bound review, repair, validation,
  authorized delivery or evidenced no-change; expose derived human views and Board questions.
- Preserve compatible preparation evidence across unrelated main changes and retain
  ownership through ambiguous submission and delivery for restart reconciliation.
- Consume exact current Board responses through guided retry/release decisions,
  preserve clarification and deferral blockers, and acknowledge response IDs durably
  without granting authority from author labels or answer text.
- Renew approved work under its existing Board ID with archived context and evidence,
  preserve unresolved result ownership, and require dependencies' current revisions
  to have accepted outcomes.
- Acknowledge applied or superseded managed Board requests after SQL commits, using
  immutable qualified receipts and persisted publication markers; retry pending
  acknowledgement without repeating actions or rewriting reviewed source.
- Retain unresolved session ownership when the provider becomes unavailable after acknowledging a session, or creates a thread with mismatched launch settings.
- Read and index Board Markdown once per scheduler pass, share that snapshot across admission and item lookups, and refresh it on the next pass. Approval remains bound to the exact source revision read.
