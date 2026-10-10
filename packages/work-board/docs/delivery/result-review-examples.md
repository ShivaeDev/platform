# Review returned work through ordinary Markdown records

A result is an ordinary file with `kind: result`, stable identity, explicit relationships, reported evidence and prose limitations. Review brings those sources together with human direction pinned to the exact report. The [roadmap](../roadmap.md) owns implementation status and acceptance; this file teaches the source and response contract.

## Author the task and report

Save this task as `items/task.md`:

```markdown
---
id: work.keyboard
kind: task
status: in-review
criteria:
  - id: focus
    text: Escape restores focus to its opening control
  - id: narrow
    text: Narrow layout stays readable
---
# Keyboard work

Review the keyboard behavior and its recorded evidence before changing status.
```

The task declares two criteria and remains in review. Its source status is authored text, rather than a computed execution or acceptance state.

Save the returned report as `items/result.md`:

```markdown
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

The change is ready for review.

## Evidence and limitations

No keyboard or narrow-layout observation is recorded in this report.

## Next action

Review the missing evidence before deciding how to continue.

::::question{id="verdict" select="one"}
### What should happen with this report?

:::option{id="revision"}
Request another revision and explain the missing evidence.
:::

:::option{id="accept"}
Accept this exact report version with its stated limitations.
:::
::::
```

This complete report deliberately contains no `evidence` records. Both criteria remain without recorded claims, even if a human accepts the report iteration with its stated limitations. Record actual observations and their supporting source only after they exist; the [evidence reference](source-examples.md#criterion-level-recorded-evidence) defines those optional fields.

The open `review` attention request explicitly asks for judgment. Its two `verdict` options are authored labels, not reserved schema values. A person can choose a revision or this report version, add rationale, or reject the framing with text. The [packet contract](decision-write-examples.md) defines completeness, selection and source binding.

## Review beside the source

Open **Review returned result** on the report, or `/_board/result?item=result.keyboard`. A uniquely identified readable result uses both the ordinary GET page and the existing native page query. The report status is shown separately from its linked task's status. Neither report status nor a handoff receipt verifies execution or authorizes a merge.

The page lists explicitly linked criteria, this result's claims, missing provenance, report/limitations and recorded human feedback. An unresolved or duplicate identity does not choose a convenient source. A missing local Markdown evidence source remains disclosed. Report and feedback context use the safe Markdown reader; exact reviewed source remains available separately.

Choose the report's explicit review request to use the existing response surface. Review the exact source, preview and submit one complete response. That response captures the source path and SHA-256 of the original report bytes. Work Board leaves the project task and report unchanged.

## Read or wait through the existing agent interface

```sh
work-board question result.keyboard/review
```

This reads the current question/context without registering it. For the complete LF report above, including its final newline, the reviewed SHA-256 is `49a45f23df2f56d8720c0fd8f8c86483a86f5b8eb016c1d17db4a56152f72060`. Inspect that context before registering the wait:

```sh
work-board wait result.keyboard/review --revision 49a45f23df2f56d8720c0fd8f8c86483a86f5b8eb016c1d17db4a56152f72060
```

The server must be running with `--responses` for registration and replies. A successful wait returns the same immutable question/response records as the browser. Its question ID supports later `response` reads, repeatable reattachment and the explicit next-reply cursor described in the [README](../../README.md#wait-for-an-attributable-reply). Feedback receipt is independent of automatic agent continuation.

## Keep feedback on its reviewed report

Feedback whose registered source path and SHA-256 both match the current report is labeled **Feedback on this exact result revision**. An ordinary edit creates a new report revision. Moving the report also qualifies earlier context, even when its bytes stay unchanged. The previous feedback and its exact reviewed snapshot remain inspectable; neither silently applies to the new report.

After an agent records a revision, the next response can explicitly supersede the prior revision request. Supersession links immutable direction rather than rewriting history, task status or evidence. Malformed or ambiguous response history stays unknown instead of establishing that no feedback exists. Actual moved record paths remain the targets of source and supersession links.

`evidence.checked_revision` is a reported full 40- or 64-digit Git revision. It is distinct from the report's content SHA-256. Work Board does not inspect the checkout or compare that reported revision with current Git state; evidence freshness remains unknown. Pinned report feedback does not verify a linked artifact. Closing attention, finishing a run, acknowledging a handoff and human acceptance remain separate facts.

## Preserve the execution boundary

Work Board owns source identity, reviewed context, relationships and human feedback. An optional execution integration may attach session/turn receipts and stages to the same work ID. It does not acquire authority to change criterion acceptance from a report status or chosen option. The existing metadata, question packets and independent response publisher carry result review; a second task ledger or acceptance writer would create a competing source of truth.

The [handoff contract](handoff-examples.md#optional-execution-integration-boundary) and [ordinary editing ownership](source-editing-examples.md) define that boundary. The roadmap owns optional adapter admission and the complete coordination-loop acceptance. Regression fixtures establish their asserted behavior, rather than representative-reader timing, independent model execution or adoption.
