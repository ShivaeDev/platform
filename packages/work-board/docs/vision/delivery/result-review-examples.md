# Review returned work through existing Markdown records

Work Board owns work identity, context, explicit relationships and human direction.
A result is an ordinary file with `kind: result`, a stable ID, declared relationships
and criterion-level evidence. An execution addon can attach session/turn receipts
and execution stages to the work ID; result status and handoff receipt are supplied
source claims, not proof of execution or permission to merge.

## A bounded review

A task has `status: in-review` and explicit criteria. Its agent writes a result with
`status: finished`, a relationship implementing that task, evidence records and
prose limitations. Work Board displays both statuses without rewriting the task.
Open **Review returned result** on the uniquely identified report; the normal GET
page and native live client share the same source.

The result's explicit open attention request of kind `review` provides the action
into the existing response surface. The agent can author a question packet:

````markdown
---
id: result.keyboard
kind: result
status: finished
relationships:
  - kind: implements
    target: work.keyboard
attention:
  - id: review
    kind: review
    state: open
    response_from: [maintainer]
    reason: Review this exact report and its limitations.
    unblocks: [work.keyboard]
---
# Keyboard result

## Evidence and limitations
Link actual source/artifacts and record actual criterion-level observations.
Do not replace missing checks with a proposed outcome.

::::question{id="verdict" select="one"}
### What should happen with this report?

:::option{id="revision"}
Request another revision and explain missing evidence.
:::

:::option{id="accept"}
Accept this exact report version with its stated limitations.
:::
::::
````

The options are authored labels, not reserved schema values or inferred verified
acceptance. The human can choose either and add Markdown rationale, or explain why
the supplied framing is unsuitable. Preview and submit one complete response.
The recorded report context includes the exact original source SHA-256/path;
ordinary agent edits produce a new report revision, not a migration or special
writer call. The next response can explicitly supersede the revision request.
Existing CLI get/wait consumers deliver those same immutable records.

## Evidence and changed context

The review lists each uniquely resolved linked criterion and this result's explicit
claims. Missing revision, method, outcome or observation time stays **Not recorded**;
an absent criterion claim stays missing even after authored acceptance of an
iteration. Missing local Markdown evidence sources remain visible. Duplicate
identities leave association or response history unavailable rather than guessing.

Human feedback matching the current report's exact source SHA-256 and path is
labeled as such. Editing or moving that report qualifies all earlier feedback;
its historical snapshot and source remain readable. Acceptance does not silently
carry to a new report version or update another file's status. Closing attention,
finishing a run, acknowledging a handoff and human feedback remain separate.

`evidence.checked_revision` remains the approved 40-/64-digit Git revision, not a
Markdown-content hash. This checkpoint does not inspect Git or compare evidence
against the current checkout. Evidence freshness is explicitly unknown; pinned
report feedback does not verify a linked artifact. D4's Git adapter discussion
remains before step 24. No new metadata field, launcher, task ledger, source-
replacing writer, dependency or cloud service is introduced.

The roadmap records actual regressions and Chromium evidence. Automated human
browser interaction is distinct from representative-reader timing and independent
agent execution.
