# Work Board roadmap

The [north star](north-star.md) defines the product direction. This file owns package implementation status, acceptance gaps and maintainer decisions. [Delivery requirements](delivery/README.md) describe the steps and repeatable checks; they do not track completion. The [framework roadmap](https://github.com/ShivaeDev/platform/blob/main/docs/framework/roadmap.md) owns composed Platform fixtures and host adoption/deployment, rather than repeating these package steps. History and release-by-release verification live in Git and the changelog.

## Built

The Board has five views: Today, Goals, Now, Library and System. Today puts human asks, Fleet work in progress and goal progress on one screen. Goals shows compact active-goal progress cards, linked criterion progress and a collapsed closed-goals section; Now shows work in board or table form; Library finds titled documents by kind, status, folders or Recently changed. System at `/_board/system` shows Codex and GitHub limits, Fleet health and every running or waiting Fleet item by title, stage and PR. `src/client/react/TodayPage.dom.test.tsx`, `TodayProgress.dom.test.tsx`, `GoalsPage.dom.test.tsx`, `sidebarLibrary.dom.spec.tsx`, `WorkNow.dom.test.tsx` and `SystemPage.dom.test.tsx` cover these projections. `src/server/http/retiredRoutes.spec.ts` and `src/client/react/retiredRoutes.dom.spec.tsx` cover destination compatibility.

The React shell uses TanStack Router and `effect-react` query loaders in one native registry and live connection. Document and identity routes mount `DocumentView` from typed source queries. Tailwind and shared primitives style Start, Handoff, Result and System. `src/server/serverStyles.spec.ts` guards against server CSS strings; route tests check shell delivery. `src/client/react/boardRouter.dom.test.tsx`, `documents.dom.spec.tsx`, `routeLoading.dom.spec.tsx`, `documentNavigation.dom.spec.tsx` and `projections.dom.spec.tsx` cover query sharing, navigation, loading failures and retained edits. `src/client/react/remainingViews.dom.spec.tsx` covers Start, Handoff, Result and System. Sidebar destinations, pins, recents, goal counts and lazy Library folders are covered by `src/client/react/sidebarLibrary.dom.spec.tsx`.

System reads provider observations from the daemon's native HTTP RPC API. `src/server/diagnostics/diagnosticsRpc.spec.ts`, `rendering.spec.ts` and `liveRefresh.dom.spec.ts` cover ready, missing, malformed, stale and unavailable sources, caching, polling and pause/resume. `src/client/react/SystemPage.dom.test.tsx` distinguishes loading, unavailable and empty Fleet item data from named running and waiting work. Synthetic fixtures do not establish live account authorization.

Human responses, reviewed handoffs and returned-result feedback retain source context and explicit uncertainty. `src/server/responses/response.spec.ts`, `publicationFlow.spec.ts`, `agentWait.spec.ts`, `src/server/handoffs/handoff.spec.ts` and `src/server/results/result.spec.ts` cover publication, waits, receipts and revision-pinned feedback. `src/client/react/formRefresh.dom.spec.tsx` and `src/client/effectForms.dom.spec.ts` cover persisted drafts, source changes and edits during submission. Managed decision acknowledgements are covered by Work Fleet's `src/board/managedRequestReceipt.spec.ts` and `acknowledgementHttp.spec.ts`. Acknowledgement does not establish execution or acceptance.

Source indexing, search, local images, source relationships and file watching retain their native query and rendering paths. `src/server/search/`, `src/server/metadata/`, `src/render/`, `src/server/http/symlinks.spec.ts` and `src/server/liveUpdates.spec.ts` cover those behaviors. `src/server/board.test.ts`, `embedding.spec.ts` and the packed-consumer gate check shell, CLI and embedding delivery. DOM fixtures prove their asserted interactions; they do not establish physical-device or browser page-cache adoption.

## Next

- [ ] Finish representative-reader acceptance for Today. The proposed target is finding the actual next judgment within 30 seconds. Automated queues and browser fixtures do not establish that outcome.
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
- **Response ownership (D2).** Questions capture exact reviewed bytes and source path; independent immutable response files retain human direction. Publication is explicitly opted in and runs on Linux and macOS. Agents keep ordinary project-file edits; surrounding agent changes win outside human response content. Practical drafts, revision checks and ordinary save failures matter; universal outside-editor transactions and a mandatory special writer do not.
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

Question deadline regressions move registered timestamps beyond 48 hours. They prove deadline handling and late reply recovery, rather than a real 48-hour soak. Publication fault tests cover persisted files on the host filesystem and synchronization failures; they do not establish a universal transaction with unrelated editors. Example claims and linked evidence remain authored records, rather than accepted results.
