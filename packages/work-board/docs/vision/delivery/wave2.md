# Wave 2 delivery — inform back and coordinate

Follow [wave 1](./wave1.md) and its real-use review. These proposed steps implement
W2.1–W2.4 of the [roadmap](../roadmap.md). D2 and D3 in the [delivery plan](./README.md)
are genuine product/contract discussions, not decisions already made by a mockup.
Prefer one dependable response loop over many editing controls.

## 14 Prove one safe source mutation

**Outcome:** the board can change one intended part of a file without losing work.
After D2, implement the smallest agreed single-file command with explicit source
identity and expected revision. Preserve surrounding text, revalidate root access,
publish a new record without replacement where supported, and expose typed rejection and save outcome.
Define handling for outside writers: a revision comparison followed by replacing the reviewed document is
not universally atomic against an unrelated editor. Prove the selected coordination
or conflict/recovery strategy and document any remaining filesystem limitations.
**Depends on:** 13 and D2. **Accept:** stale and competing writes, write failures,
renames, permission failures, and repeated submissions cannot silently discard
user content or report success without a known persisted result. Add a minimal
visible action in this PR so the command is exercised through the real server.

## 15 Respond to the exact thing you reviewed

**Outcome:** feedback belongs to the proposal or result that prompted it.
Build the agreed anchored response and revision-request surface over 14. Bind
responses to the item and reviewed source revision; retain drafts during refresh,
navigation, and recoverable failure. Show pending, saved, rejected, and uncertain
outcomes distinctly. Recheck the content trust model and new write authorization;
read-mode raw HTML must not gain permission to trigger edits simply because it is
served by the same local application.
**Depends on:** 14. **Accept:** changing the proposal while a response is drafted
preserves the draft and identifies the revision difference before submission;
failed submission does not clear input or produce a false saved confirmation.

## 16 Record a decision and its consequence

**Outcome:** a choice creates durable direction that the next contributor can use.
Turn 06's read-only decision comparison into a decision action with selected option,
rationale, reviewed revision, affected work, and next action. Show what will be
recorded before saving. Distinguish a superseding decision from editing history.
Keep this single-file where possible; do not automatically rewrite every affected
task to simulate cross-file transactions.
**Depends on:** 06 and 15. **Accept:** the choice survives reload and appears in
linked context; a changed proposal does not inherit an earlier approval without
qualification. Demonstrate recovery when the source moves or disappears.

## 17 Narrow editing and honest undo

**Disposition:** deferred by the approved
[ordinary-file editing and response ownership boundary](./source-editing-examples.md).
Agents keep editing project Markdown with their usual tools; Work Board owns human
responses. Do not implement direct editing or a universal concurrent-writer engine
as a prerequisite for coordination. The original editing scope below remains
unimplemented, rather than accepted through documentation.

**Outcome:** routine updates no longer require leaving the work context.
Add create/title/checklist/status actions one at a time through the same command
path. Add explicit move controls, then optional drag-and-drop with the same
keyboard behavior. Preserve unrelated formatting and meaningful source order.
Offer undo based on the actual saved change and current revision; retain later
editor or agent changes rather than restoring an entire obsolete file snapshot.
**Depends on:** 14–16. **Accept:** edits round-trip to readable Markdown; an edit
followed by another writer's change either undoes safely or explains the conflict.
Keep cross-file moves and automatic one-file-per-item migration out until their
partial-failure and recovery behavior has its own design and proof.

## 18 One local agent handoff

**Outcome:** one existing agent tool can receive complete direction and acknowledge it.
D3 approved existing-session polling and a copied file instruction. The local
Markdown handoff carries goal,
constraints, source references/revisions, acceptance criteria, owner, and next
action. Record requested, acknowledged, rejected, and unavailable states. Use a
handoff identity to recognize retries without creating duplicate work. An
acknowledgment means receipt, not completed execution or accepted results.
The [approved D3 walkthrough](./handoff-examples.md) defines ordinary receipt
edits and copying a tiny prompt into an existing session. It does not launch agents.
**Depends on:** 15–16, the ownership decision for deferred 17, and D3.
The agent must be able to acknowledge by editing ordinary files; a special writer
or acknowledgment command cannot be mandatory. **Accept:** send one real handoff, observe receipt,
and exercise unavailable tool, duplicate request, and lost-acknowledgment cases.
Never silently switch agent/tool or assume a timed-out request was not received.

## 19 Review a returned result against its criteria

**Outcome:** the agent's result becomes inspectable work requiring explicit review.
Receive artifact/source references, checked revisions, criterion-level claims,
supporting evidence, and stated limitations. Keep execution state separate from
work state. Support request-revision and explicit human acceptance through 15–16's
versioned response path. Surface stale evidence or changes after review without
silently carrying acceptance to a new result.
**Depends on:** 06, 10, and 18. **Accept:** a returned run can be finished while
its item remains in review; missing evidence stays missing; a human requests a
revision, receives a new result, and accepts the specific reviewed version.

## 20 Complete the first coordination loop

**Outcome:** one real feature moves from proposal to accepted result locally.
Run a real bounded feature through decision, handoff, acknowledgment, result,
revision request, second result, and acceptance. Include a restarted browser/server,
an offline/unavailable agent tool, and an editor changing a relevant file. Verify
that another agent can resume from the resulting files without reconstructing a
chat history. Record remaining failure modes and revise the interaction design.
**Depends on:** 14–19. **Accept:** the roadmap's wave 2 exit is demonstrated with
real source/evidence and no silent overwrites. Only then plan multiple contributors
and broader adapters. This does not imply production-grade concurrent co-editing.

## Deliberate exclusions

No general rich-text editor, hidden task database, arbitrary script execution,
agent scheduler, full terminal UI, or external two-way synchronization. The browser,
local CLI/API, and tool adapter must share mutation semantics rather than invent
parallel write paths. Use existing Effect and Platform conventions where needed;
choose concrete API names and transports at their design gates.

## Approved response checkpoint

D2 authorizes 14–15's append-only question/response files, browser draft policy and
per-question CLI wait. The original project document is preserved; this checkpoint
uses no-replace publication instead of a source-replacing patch. The later
[ownership decision](./source-editing-examples.md) defers step 17's general project
editing and undo; it accepts best-effort ordinary editor races rather than requiring
a universal replacement transaction.
The passive wait is an existing-session consumer, not step 18's handoff/launch adapter.
See [the source contract](./response-write-examples.md) and the roadmap for actual
acceptance evidence and first-platform filesystem limits.

## Approved rich decision checkpoint

Step 16 uses agent-authored directive question packets over the approved response
publisher. One packet submits together; optional typed answers accompany readable
Markdown, with extra human text, exact context and explicit superseding identity.
See [the contract and examples](./decision-write-examples.md). This does not settle
an inline-response format or D3 agent handoff contracts. Project editing follows
the approved ownership boundary; the original step 17 controls remain deferred.
