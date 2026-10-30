# Worker and reviewer protocol

Work Fleet's generated prompts tell each worker and reviewer how to finish a turn, and Fleet reads only explicit markers from the final message. This page describes those markers and what Fleet does with them. The [README](../README.md) explains where they fit in a run. These prompts direct worker behavior; runtime policy still owns execution authority, and a report line is not proof of an adopted result or accepted delivery.

## Pull request workers

Cloud worker instructions include startup waiting, the configured environment script, fetching current main to start the branch, repository checks and one pull request for human review. Workers watch required CI checks after every push, repair required failures on the same branch and report once required CI is green on their exact head. Only checks required by GitHub branch protection or repository rulesets gate the pull request; optional app checks are information and must not trigger repair, waiting or a question. The merge queue re-runs CI against latest main before merging. Workers merge main only when GitHub reports a conflict or their change needs something that landed there; a conflict-free branch behind main does not require a merge, fresh review or revalidation.

Workers state the exact head's CI result before the final `FLEET_PR: <url>` or `FLEET_PR: none` line. The parser requires exactly one marker on the final line; missing or malformed reports yield no result.

With `"result": "github"`, the final two report lines are one `FLEET_HEAD: <sha>` line with the full head SHA and one `FLEET_PR: https://github.com/<owner>/<repo>/pull/<number>` line. Both markers tolerate surrounding whitespace and backticks around their values.

```text
Required checks passed on the exact head.
FLEET_HEAD: 0123456789abcdef0123456789abcdef01234567
FLEET_PR: https://github.com/example/project/pull/7
```

A final `FLEET_PR: none` claims no change at the reported `FLEET_HEAD`. Fleet retains that head and the report as evidence, and passes the result through review when enabled and required checks. Main movement does not invalidate the report; a changed task revision prevents adoption.

## Corrections

When GitHub adoption rejects a completed worker or repair report's format, Fleet requests one corrected report on the same worker thread, with the exact required ending. A second malformed report needs a human; answering `retry` starts a new correction turn.

Reports whose PR head moved also receive a correction turn on the existing worker thread; a second stale report needs a human retry. Reports rejected for repository identity or PR state still need a human decision. Correction attempts retain launch settings, persist before submission and reconcile lost acknowledgements after restart.

## Questions

Cloud worker prompts instruct workers to stop for a decision with `FLEET_QUESTION: <question>` and include the context and choices needed to answer. Fleet recognizes this marker in a completed worker or repair turn and publishes the question through Board's response writer, waiting on the orchestrator by default.

Only `FLEET_MAINTAINER_QUESTION: <question>` escalates a worker question to the maintainer; mentioning the maintainer in ordinary question text does not escalate it. Questions must use one of these explicit markers; Fleet does not infer questions from prose.

## Research reports

Report workers leave repository sources unchanged and return the whole report in the final message. They may create new uncommitted report attachments, but must never commit, push, create branches or open PRs.

Cloud report workers fetch `origin/main` and check it out detached before setup and research. Their brief names the expected base commit from dispatch. The final report ends with one `FLEET_HEAD: <full 40-character checked revision>` line from `git rev-parse HEAD`. Fleet stores it as the attempt's `reportRevision` and delivers only reports on the dispatched base or a verified descendant. Missing, older or divergent revisions create an orchestrator decision without publishing a report; release and dispatch again to research current main. Composed hosts can provide `FleetIntegrations.isAncestor(base, revision)` to verify descendants; without it, reports must name the exact dispatched base.

### Attachments

The CLI host reconstructs report attachments from the completed turn’s paginated `thread/items/list` file changes. Workers must create every attachment with the file-edit/apply_patch tool under `/tmp/fleet-report/attachments/`, and use that tool for later edits. Adds contain UTF-8 file content; update hunks and deletes replay in item order to obtain each file’s final bytes. Files created or changed through shell commands are not exposed as file changes. Binary evidence must be attached as a base64 text file with its encoding stated. List every promised file on a separate final-report line, `FLEET_ATTACHMENT: <relative-path>`, so Fleet can record missing files. Files from other directories and earlier turns are excluded.

Retrieved files are saved in `responses/fleet-report.<digest>.attachments/` beside the result, with links in the report. Markdown attachments receive a `.attachment` suffix so Board does not index them as authored items. Reconstruction uses only new regular scratch files, with normalized relative paths, `lstat`, resolved-path containment and no-follow opens.

Turn item downloads are limited to 16 MiB of cumulative UTF-8 JSON, attachment changes to 8 MiB, attachment count to 64 and aggregate attachment bytes to 32 MiB. Unsafe paths, missing adds, mismatched update hunks, unavailable retrieval and collection-limit failures publish report text with an Unavailable attachments section; they do not create a decision. Other retrievable files survive per-file reconstruction failures. Existing saved attachment bytes are never replaced.

Local attachment validation and saved-payload failures park the completed attempt with the failed file path and cause. Report file errors stay tagged in the Effect channel until the Board or platform boundary maps them.

### Publication

After a completed worker turn, Fleet publishes an ordinary `kind: report` item under `responses/fleet-report.<digest>.md`, with an `informs` relationship to the task. The result preserves the whole final output and records the exact session, turn and task revision in its worker receipt. The Markdown gateway uses Board's durable publisher; custom gateways implement `BoardGateway.report` with the same immutable, idempotent boundary.

Before writing attachments or publishing, the CLI host saves the complete report text, retrieval warnings and attachment bytes in an immutable payload under `.fleet-reports/`, outside Board’s source index. Publication retries read that payload without recollecting files, preserving the same identity and bytes after restart or a lost acknowledgement even when Cloud retrieval changes.

After a terminal report turn, the host checks the configured GitHub remote for the exact `<branchPrefix><workId>` ref and all PRs opened from that branch, including closed PRs. A published branch or PR makes the work wait on the orchestrator with the reason `Report worker published to GitHub`; Fleet never deletes the branch. Unavailable remote evidence also blocks completion. The host rechecks before result publication on retry. Custom headless runtimes provide their report inspection and collection boundaries; the Markdown gateway alone publishes report text.

Empty or whitespace-only output, or a complete report document over Board’s 256 KiB UTF-8 context limit, creates an orchestrator decision with a concrete reason instead of a result. The size check includes metadata, the worker receipt and attachment links, and runs before writing attachment files. Oversized reports leave no attachment folder.

## Reviewers

Reviewers receive the worker’s repository paragraph, the titles and bodies of implemented goals, the readable task and criteria, then the adopted PR, changed paths and exact-head check results. They do not receive the worker conversation. The Codex adapters request read-only execution with shell network access for read-only PR and exact-head CI inspection, and no escalation. Reviewers use existing exact-head repository objects, read-only repository tools or `gh pr view`, `gh pr diff` and `gh api --method GET`; network writes are prohibited.

When the exact-head diff and check results are readable, the prompt requires a verdict. Passing required checks at that head are CI evidence even when job logs or artifacts are unavailable; reviewers record that limitation in their evidence.

The reviewer ends with `FLEET_REVIEW:` followed by JSON containing `head`, `verdict` (`approve` or `changes`), nonempty `evidence` and `findings`. Changes require concrete findings; approval requires an empty findings array. Fleet accepts this verdict only after the exact turn completes and records it with that revision and receipt.

In blocking mode, a malformed completed verdict gets one automatic follow-up on the same read-only reviewer thread requesting the required format. Fleet persists that attempt before submission and reconciles its receipt after restart; a second malformed reply produces a decision waiting on the orchestrator. Retry after that decision starts a fresh independent reviewer instead of parsing the same completed verdict again.

### Review documents

Each completed review reply becomes a Board report document with an `informs` relationship to the task. The reviewer writes `## TL;DR` first, with a verdict and at most five one-line findings, followed by `## Details`, where findings give the claim, evidence, likelihood in real use, impact and suggested fix. Remote findings are omitted; a review with no findings says so in one line.

Fleet keeps the reply as returned. A reply missing the requested shape is retained with a malformed note. Ready-to-merge decisions and the Board’s ready list show the TL;DR and link to the review document. Repository review rules belong in `worker.reviewerGuidance`.
