# Explicit attention requests

Work Board reads an optional `attention` list from richer item frontmatter. Each record names one request independently of the item's authored status, owner or next action. A request ID is unique within that item and uses the case-sensitive ASCII item ID syntax. Its identity is the pair (item ID, request ID).

```yaml
id: result.search
kind: report
attention:
  - id: keyboard-review
    kind: review
    state: open
    response_from: [maintainer]
    reason: Review the recorded keyboard evidence before continuing.
    unblocks: [work.search#keyboard]
  - id: matching-decision
    kind: decision
    state: open
    response_from: [maintainer]
    reason: Choose literal matching or fuzzy matching for the next checkpoint.
    unblocks: [decision.search-matching]
```

The ordinary Markdown body holds the options, rationale and evidence links. Today shows two independent requests from the same item, and each row opens that request's answer card.

A blocker is also an explicit request, not a deduction from a dependency edge:

```yaml
id: work.search
kind: task
attention:
  - id: missing-fixture
    kind: blocker
    state: open
    response_from: [agent-navigation]
    reason: Supply a representative keyboard fixture to continue validation.
    unblocks: [work.search#keyboard]
```

This says the author requests a response; it does not prove the target cannot proceed or start an agent. Recipients are literal local labels, not verified identities, an account directory, a permission boundary or a notification route.

## What Today lists

Today lists an open request only when its `response_from` includes the maintainer label, `maintainer` unless the server runs with `--maintainer <name>`, and links each row to the request's answer card at `/_board/item/<item-id>/#answer-card-<request-id>`. The `agent-navigation` blocker above stays off Today. A request drops off Today once a response of type `answer` is recorded against the item's current source path and bytes, while its authored `state` stays `open`; a managed request stays until its receipt settles it. Open maintainer requests that unblock the same items share one row, which shows the most recently modified request.

Today also lists unanswered authored questions without a captured `question` record, and items owned by `marvin` with a `next_action`. Questions with explicit requests use those requests rather than a second item row. A question leaves Today once answered. Done and dropped items leave the open queue; deferred items move to Later. Requests addressed only to other labels stay outside Today. See the [README vocabulary](../../README.md#work-vocabulary) for authored fields.

## Reading rules

| Field | Source shape and meaning |
| --- | --- |
| `attention` | Optional list; absent/empty means no recorded request |
| `id` | Required request ID, unique within the item |
| `kind` | Required `decision`, `review`, or `blocker` |
| `state` | Required `open` or `closed`; explicitly authored source state |
| `response_from` | Required nonempty list of nonblank literal labels |
| `reason` | Required nonblank text explaining why a response is needed |
| `unblocks` | Required nonempty list of item ID or `item.id#criterion-id` references |
| `managed` | Optional boolean; an execution integration may opt a generated decision into exact-context request acknowledgement |

Only unique, valid open requests on unique identified items with resolvable targets enter the queues. Missing recipients/reason/state, unsupported fields or invalid reference syntax make the attention list uninterpreted, like the other frontmatter fields; retain the whole original list and report its source issue. Independent valid fields and ordinary Markdown remain readable. Duplicate request IDs, missing item IDs and unresolved/ambiguous targets stay unclassified with source diagnostics. No request silently chooses a duplicate winner.

A closed request remains readable and searchable but leaves the open queue. Closing it records an author's state claim; it does not verify evidence or prove human acceptance, a response, authorship or approval. A response records direction against its captured context; it does not change that authored request state. See the [response contract](./response-write-examples.md).

For a generated decision marked `managed: true`, a separate qualified `request_receipt` can remove the request from the open queue without changing its source state. The receipt must match the registered question's exact source path and bytes. Applying it requires the unique current answer; superseding it does not invent an answer. Ordinary authored requests keep the rules above. See the [managed acknowledgement rules](../../README.md#record-a-human-response).

Request text and recipients are searchable; source targets contribute backlinks. An incomplete workspace returns an explicit unavailable state and withholds queue counts and classification. Source issues show as diagnostics on their document, never on Today: a request in a malformed list, with a duplicate ID or with an unresolved target does not appear there. Two problems do show on a Today row: an item row whose ID is missing or duplicated names that problem and links to its file, and a managed request whose receipts disagree names those receipt files. Files and requests remain local; the UI never writes their contents.

## Ambiguity and quiet examples

- `status: ready` with `owner: marvin`, no `next_action` and no attention list: no request and no Today row.
- `next_action: Ask Maintainer` without an `owner`, a finished run, or repeated edits: no request.
- Two `keyboard-review` records on one item: neither wins or appears on Today; the document shows a diagnostic.
- Two items with the same ID: do not assign either item's requests.
- `unblocks: [missing.id]`: the document shows a diagnostic and Today omits the request; the request stays readable in its original file.
- `state: closed`: no open queue entry, with no acceptance claim.
- A complete workspace with only valid closed requests: a quiet Today.
- Malformed YAML: the document keeps its readable prose and shows a diagnostic; Today omits its requests, so a workspace whose only requests are malformed shows a quiet Today.
