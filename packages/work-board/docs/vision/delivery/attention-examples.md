# Explicit attention requests

Work Board reads an optional `attention` list from richer item frontmatter. Each
record names one request independently of the item's arbitrary status, owner or
next action. A request ID is unique within that item and uses the existing
case-sensitive ASCII ID syntax. Its identity is the pair (item ID, request ID).
The overview at `/_board/overview` links each request to its exact source context.

```yaml
id: result.search
kind: result
attention:
  - id: keyboard-review
    kind: review
    state: open
    response_from: [marvin]
    reason: Review the recorded keyboard evidence before continuing.
    unblocks: [work.search#keyboard]
  - id: matching-decision
    kind: decision
    state: open
    response_from: [marvin]
    reason: Choose literal matching or fuzzy matching for the next checkpoint.
    unblocks: [decision.search-matching]
```

The ordinary Markdown body holds the options, rationale and evidence links.
The overview shows two independent requests from the same item. Opening either
leads to the existing source context and its explicit target links.

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

This says the author requests a response; it does not prove the target cannot
proceed or start an agent. Recipients are literal local labels, not verified
identities, an account directory, a permission boundary or a notification route.

## Reading rules

| Field | Source shape and meaning |
| --- | --- |
| `attention` | Optional list; absent/empty means no recorded request |
| `id` | Required request ID, unique within the item |
| `kind` | Required `decision`, `review`, or `blocker` |
| `state` | Required `open` or `closed`; explicitly authored source state |
| `response_from` | Required nonempty list of nonblank literal labels |
| `reason` | Required nonblank text explaining why a response is needed |
| `unblocks` | Required nonempty list of existing item/criterion reference shapes |

Only unique, valid open requests on unique identified items with resolvable
targets enter the queues. Missing recipients/reason/state, unsupported fields or
invalid reference syntax make the attention list uninterpreted, like the other
frontmatter fields; retain the whole original list and report its source issue.
Independent valid fields and ordinary Markdown remain readable. Duplicate request
IDs, missing item IDs and unresolved/ambiguous targets stay unclassified with
source diagnostics. No request silently chooses a duplicate winner.

A closed request remains readable and searchable but leaves the open queue.
Closing it records an author's state claim; it does not verify evidence or prove
human acceptance, a response, authorship or approval. Response recording,
concurrent writes and review decisions remain behind the mutation discussions.

The overview groups decisions, reviews and blockers with visible counts, then
orders each group by source title, item ID and request ID. Each entry shows the
recorded reason, recipients, target links and origin file/line. Request text and
recipients are searchable; source targets contribute backlinks. An incomplete
workspace returns an explicit unavailable state and withholds queue counts and
classification. Source issues are disclosed separately from a genuine quiet
state. Files and requests remain local; the UI never writes their contents.

## Ambiguity and quiet examples

- `status: in-review` with `owner: marvin` and no attention list: no request.
- `next_action: Ask Marvin`, a finished run, or repeated edits: no request.
- Two `keyboard-review` records on one item: neither wins; show a source issue.
- Two items with the same ID: do not assign either item's requests.
- `unblocks: [missing.id]`: show a source issue outside the actionable queue;
  keep the request readable in its original file.
- `state: closed`: no open queue entry, with no acceptance claim.
- A complete workspace with only valid closed requests: quiet overview.
- Malformed YAML: retain readable prose and disclose the source issue; do not
  present it as a confirmed quiet workspace.

## Design reference

The [Antumbra attention guide](https://github.com/ShivaeDev/antumbra/blob/1a5f6ec2444336f2f75339385324304b6bc3bb9a/docs/design/attention-and-memory.md)
separates durable requests from interruption and execution. Its
[rulings guide](https://github.com/ShivaeDev/antumbra/blob/1a5f6ec2444336f2f75339385324304b6bc3bb9a/docs/design/rulings.md)
keeps the question, context and answer together. This read-only checkpoint keeps
authored requests and their source context reachable. It does not implement
Antumbra's authority ladder, urgency, scheduling, append-only journal or response
lifecycle; several attention lanes are explicitly intended in that project too.
