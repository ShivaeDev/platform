# Work Fleet roadmap

## Implemented

- A CLI and embeddable Effect coordinator with Schema contracts and transactional
  SQLite state for finite batches.
- Explicit execution and merge decisions, task holds, capacity, quota gating,
  lifetime attempt limits and source reservations.
- Worker, independent reviewer and original-session repair turns; revision-bound
  outcomes and review invalidation when the PR head or base changes.
- Intent before submission, durable acknowledgements, restart reconciliation and
  conservative handling of uncertain agent, publication and merge requests.
- A local Codex app-server adapter and a GitHub adapter for publication,
  observation, no-change verification and ordinary merge.
- Generated Active, Completed and Needs human Markdown; optional viewing through
  the existing Work Board CLI or embedding interface.
- Scripted providers for offline application tests and demonstrations.

## Next: reduce interruptions in real use

1. Establish a small, explicitly authorized live acceptance run for the installed
   Codex version: committed change, independent review, repair, checks and
   ordinary merge. Protocol fixtures and scripted delivery do not establish
   this live compatibility. Measure operator interventions and the time from
   freed capacity to replacement work.
2. Add explicit, audited resolution of partial publication and uncertain merge
   requests. Submission receipt attachment and confirmed-absence decisions already exist. Resume alone must not manufacture evidence that an external
   effect never happened. Accept scoped decisions while the coordinator is
   running, without interrupting active local turns.
3. Reduce manual preparation of dedicated standalone clones and dependencies.
   Keep linked worktrees unsupported until their shared metadata can be handled
   without extending a worker's authority to other checkouts.
4. Observe provider quota and usage when a supported interface provides them.
   Today quota is an operator setting and the attempt budget is a count, not a
   token or money budget. Add explicit reservations for work owned by other
   sessions or tools before operating alongside them.
5. Support scoped JSON-key publication with structural verification. Scheduling
   can distinguish keys today; the concrete publisher refuses changes supported
   only by key-level authority.
6. Add targeted evidence refresh and backoff where actual batch size warrants
   it. Keep checks and base integration useful without reconstructing historical
   transcripts before every admission.

## Verification boundary

Scripted providers and protocol fixtures exercise coordination without inference.
A synthetic repository verified `git add` and `git commit` under the installed
OS sandbox without remote calls. A read-only public GitHub PR query verified the
observation field contract. No live model-to-merge run is claimed.

## Outside the current boundary

Hosted Cloud execution, API-billed model execution, automatic checkout creation,
remote multi-user control, deployment promotion and continuous planning are not
implemented. A provider addition needs explicit authentication, billing and
recovery semantics before it can become an option. There is no planned plugin
platform, desktop shell or workflow language.
