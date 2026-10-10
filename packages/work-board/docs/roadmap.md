# Work Board roadmap

The [north star](north-star.md) defines the product direction. This file owns package implementation status, acceptance gaps and maintainer decisions. [Delivery requirements](delivery/README.md) describe the steps and repeatable checks; they do not track completion. The [framework roadmap](https://github.com/ShivaeDev/platform/blob/main/docs/framework/roadmap.md) owns composed Platform fixtures and host adoption/deployment, rather than repeating these package steps. History and release-by-release verification live in Git and the changelog.

## Built

The reading, response, handoff and result-review implementation has these capabilities. Each row links the delivery requirement and the regressions that establish its behavior.

| Steps | Capability | Evidence |
| --- | --- | --- |
| [01](delivery/wave1.md#01-a-real-workspace-shell) | Workspace shell, theme/density/sidebar preferences | `src/page/shell.test.ts`, `src/page/client.dom.test.ts` |
| [02](delivery/wave1.md#02-document-locations-and-reading-state) | Passage links, reading navigation, favorites and recents | `src/render/documentHeadings.test.ts`, `src/page/navigationScript.dom.test.ts` |
| [03](delivery/wave1.md#03-find-work-from-anywhere) | Local deterministic search and command dialog | `src/search/entries.test.ts`, `src/http/search.test.ts`, `src/page/searchRequests.dom.spec.ts` |
| [04](delivery/wave1.md#04-optional-identity-and-a-rebuildable-index) | Optional identity, metadata and rebuildable reference index | `src/metadata/parse.test.ts`, `src/metadata/model.test.ts`, `src/http/identity.test.ts` |
| [05](delivery/wave1.md#05-one-body-of-work-several-views) | Shared board/table projections, URL state and named local views | `src/http/work.test.ts`, `src/http/tableViews.spec.ts`, `src/page/savedViews.dom.spec.ts` |
| [06](delivery/wave1.md#06-follow-the-reasoning-and-the-evidence) | Relationships, source backlinks and recorded criterion claims | `src/http/reasoning.spec.ts`, `src/page/reasoning.dom.spec.ts` |
| [07](delivery/wave1.md#07-an-attention-first-overview), implementation only | Explicit attention queues and source diagnostics | `src/metadata/attention.spec.ts`, `src/http/attention.spec.ts`, `src/page/attention.dom.spec.ts`; reader acceptance remains below |
| [08](delivery/wave1.md#08-what-changed-since-i-last-looked) | Explicit browser-local seen baseline and source comparison | `src/history/baseline.test.ts`, `src/history/compare.test.ts`, `src/history/history.dom.spec.ts` |
| [09](delivery/wave1.md#09-live-updates-that-preserve-orientation) | Native reads, targeted invalidation, pause/resume and reconciliation | `src/rpc/native.spec.ts`, `src/rpc/affected.test.ts`, `src/rpc/hints.test.ts`, `src/page/nativeUpdates.dom.spec.ts` |
| [10](delivery/wave1.md#10-local-visual-evidence) | Contained local images and diagram/image inspection | `src/http/localImages.spec.ts`, `src/page/visuals.dom.spec.ts` |
| [11](delivery/wave1.md#11-a-small-vocabulary-for-visual-documents) | Sourced metric/progress/timeline directives and callouts | `src/render/visualReading.spec.ts` |
| [12](delivery/wave1.md#12-start-with-useful-project-documents) | Empty-workspace guidance and copyable project/report templates | `src/http/startReading.spec.ts`, `src/page/navigationScript.dom.test.ts` |
| [14–15](delivery/wave2.md#14-prove-one-safe-source-mutation) | Opted-in immutable question/response publication, drafts and durable waits | `src/responses/response.spec.ts`, `src/responses/publicationFlow.spec.ts`, `src/responses/agentWait.spec.ts`, `src/browser/responses/draftOwnership.dom.spec.ts` |
| [16](delivery/wave2.md#16-record-a-decision-and-its-consequence) | Rich question packets and explicit superseding direction | `src/responses/template.test.ts`, `src/responses/questionnaire.spec.ts`, `src/responses/questionnaireForm.dom.spec.ts` |
| [18](delivery/wave2.md#18-one-local-agent-handoff) | Reviewed Markdown handoffs, copied prompts and ordinary file-edited receipt | `src/handoffs/handoff.spec.ts`, `src/handoffs/handoffForm.dom.spec.ts` |
| [19](delivery/wave2.md#19-review-a-returned-result-against-its-criteria) | Returned-result reading and version-pinned feedback without inferred criterion acceptance | `src/results/result.spec.ts` |

Directory reference reading and watcher recovery are covered by `src/http/symlinks.spec.ts` and `src/liveUpdates.spec.ts`. Fetch-handler and real HTTP embedding are covered by `src/board.test.ts` and `src/embedding.spec.ts`. The packed-consumer gate checks the CLI and embedding declarations.

Nested sidebar ancestry, home ordering, logical reference paths and folder expansion through live changes and navigation are covered by `src/page/nav.dom.test.ts`. Exact-context managed decision acknowledgements are covered by Work Fleet's `src/board/managedRequestReceipt.spec.ts` and `src/board/acknowledgementHttp.spec.ts`; those receipts leave source bytes intact and do not establish execution, acceptance or delivery authority.

## Next

- [ ] Finish [07's representative-reader acceptance](delivery/wave1.md#07-an-attention-first-overview). The proposed target is finding the actual next judgment within 30 seconds. Automated queues and browser fixtures do not establish that outcome.
- [ ] Finish [13's complete reading-workflow review](delivery/wave1.md#13-prove-the-complete-reading-workflow). Use the [repeatable reading review](delivery/reading-review.md), agree performance budgets, and gather representative-reader, physical-device and actual browser page-cache lifecycle evidence. Technical reading and embedding checks do not silently accept this step.
- [ ] Prove [20's complete coordination loop](delivery/wave2.md#20-complete-the-first-coordination-loop). Use one bounded real feature for decision, manual handoff, receipt, result, revision and specific-report acceptance. Include restarts, unavailable delivery and ordinary external edits. Result fixtures do not establish that adoption loop.

[17's direct item editing and undo](delivery/wave2.md#17-narrow-editing-and-honest-undo) are deferred. Agents use ordinary file tools and Work Board owns human response content. The original create/title/checklist/status/move controls are unimplemented; they do not block file-based handoffs. No inline-response source format is settled by this ownership decision.

After that coordination loop, the following work stays in dependency order:

| Step | Intended work | Prerequisite |
| --- | --- | --- |
| [21](delivery/wave3.md#21-successive-contributions-with-clear-ownership) | Successive contributions with visible ownership and stale proposals | Complete coordination loop |
| [22](delivery/wave3.md#22-several-local-projects-one-attention-view) | Explicitly selected local projects in one attention view | Single-project collaboration |
| [23](delivery/wave3.md#23-richer-plans-and-linked-reviews) | Bounded compositions, dependency views and linked in-app review | Existing source vocabulary and returned-result review |
| [24](delivery/wave3.md#24-one-optional-read-only-github-adapter) | One read-only adapter for explicitly linked GitHub PR evidence | D4 and demonstrated repeated manual work |
| [25](delivery/wave3.md#25-read-existing-local-test-and-build-artifacts) | One reader for existing local machine-readable check artifacts | Returned-result evidence model |
| [26](delivery/wave3.md#26-quiet-rules-and-a-real-collaboration-review) | Explainable quiet rules and actual collaboration review | Reliable triggers and explicit ownership |

## Maintainer decisions and open questions

- **Source convention (D1).** Optional per-file YAML identity, explicit relationships, membership, criteria and claims coexist with plain Markdown and heading boards. Missing values stay unknown. The [source conventions](delivery/source-examples.md) define the current shape.
- **Response ownership (D2).** Questions capture exact reviewed bytes and source path; independent immutable response files retain human direction. Publication is explicitly opted in and Linux-only. Agents keep ordinary project-file edits; surrounding agent changes win outside human response content. Practical drafts, revision checks and ordinary save failures matter; universal outside-editor transactions and a mandatory special writer do not.
- **Handoff contract (D3).** Ordinary Markdown direction, a copied pointer into an existing session and file-edited receipt are delivered. The [handoff contract](delivery/handoff-examples.md) keeps requested, acknowledged, rejected and unavailable receipt separate from execution and acceptance.
- **Optional execution integration.** Does repeated manual work justify a supported existing-session notification hook or explicit local CLI launch? Who owns priority, assignment and execution authority in that integration? Keep manual copying useful and attach execution facts to the same work ID; the handoff receipt must not become a completion or acceptance state.
- **Result-review meaning.** Human feedback is pinned to exact report bytes and source path. Authored acceptance options do not establish missing criterion evidence or change linked work status. Ordinary edits create another report revision; the existing response records retain prior reviewed context.
- **Coordination acceptance.** Which bounded feature and real participants should establish step 20's complete loop? Decide the adoption evidence without treating an automated result fixture or supplied run status as independent agent execution.
- **External evidence (D4, open).** Which repeated manual step justifies an adapter? Specify authoritative fields, opt-in, refresh/offline behavior and a maintenance owner before choosing dependencies or transport. Keep local authored plans and decisions authoritative.
- **Acceptance bar.** Do the proposed 30-second orientation target and the current reader/device/page-cache checks remain the intended exit for 07/13? What realistic workspace, machine and performance budget should guide optimization?
- **Integration surface.** The manifest exposes every defining `.ts` module. Which secondary client, rendering or indexing modules should receive the same consumer-facing guidance as the CLI, `boardLayer` and native handoff contract?
- **Resource bounds.** What browser bundle, simultaneous-tab capacity and waiter resource budgets should be measured? A short idle sample or edited deadline does not prove a long-duration soak, 48-hour availability or automatic model wakeup in every harness.

## Evidence limits

Regression tests establish their asserted source, HTTP and DOM behavior. DOM fixtures use a Mermaid stub and do not establish layout, actual Mermaid rendering, physical device lifecycle or real page-cache adoption. The browser acceptance instructions exercise those boundaries separately; release observations in Git are not new verification from a documentation change.

Question deadline regressions move registered timestamps beyond 48 hours. They prove deadline handling and late reply recovery, rather than a real 48-hour soak. Publication fault tests cover persisted Linux files and synchronization failures; they do not establish a universal transaction with unrelated editors. Example claims and linked evidence remain authored records, rather than accepted results.
