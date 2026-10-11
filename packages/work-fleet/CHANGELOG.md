# Changelog

## Unreleased

- Share the scoped GitHub CLI reader between worker-result adoption and required checks.
- Select GitHub worker-result adoption in host configuration. Require a final PR marker and exact reported head, record the observed PR number and paginated changed paths, and reject closed PRs or revision movement. Reported no-change still requires independent review and validation.
- Publish stopped worker questions through Board and continue the same thread with the recorded answer, using a durable submission intent to prevent repeated continuation after concurrent resolution, restart or a lost acknowledgement.
- Read GitHub check runs and commit statuses for the adopted PR's exact SHA, retain
  pending checks in validation and send failed check names and links to repair.

- Add the `work-fleet` command: `run` schedules approved Board work, `dispatch`
  launches one item, `status` lists active, done and needs-human work, and `wait`
  blocks on one item and exits with its outcome. Host settings come from a
  `fleet.config.json` in the Board folder.
- Approve Board work with `fleet: approved` frontmatter on the exact revision read.
- Launch Codex Cloud workers through a hosted provider with model, reasoning effort
  and service tier from host config, overridable per item, and read their final output.
- Build Cloud worker prompts from one template with a startup block and a parseable
  `FLEET_PR:` report line.
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
