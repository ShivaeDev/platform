# Local change history — step 08 contract

This contract defines retained browser data and the meaning of “last looked”. Markdown files remain authoritative and are never written by the Changes view. Implementation and reader acceptance are tracked only in the roadmap.

## One explicit review baseline per workspace

The Changes view compares the current readable workspace with one snapshot the reader marked seen. First visit says **No previous snapshot**; **Start remembering changes** records the current workspace. Reading a diff or receiving a live update does not silently acknowledge it. **Mark current workspace seen** replaces the baseline after review. The view is **Changes since seen**.

Browser storage is scoped by origin and workspace. Retain at most one snapshot, for at most 30 days, with at most 2 MiB of serialized data per workspace. It contains file paths and source text (including any recorded item IDs): old or deleted prose can therefore remain locally until replaced, cleared or expired. There is no server history, event journal, author identity, remote storage or synchronization.

The private, versioned browser record has this shape:

```json
{
  "version": 1,
  "recorded_at": "2026-10-05T19:45:00Z",
  "documents": [
    {
      "file": "items/search.md",
      "source": "---\nid: work.search\nstatus: in-review\n---\n# Search\n"
    }
  ]
}
```

The recorded time names the browser baseline observation, not when a source was written, who authored it or when a decision was accepted. Decode stored and HTTP boundary data with Schema; an invalid/unsupported record establishes no history.

**Clear remembered history** removes the snapshot and stays off until the reader starts again. Expiry makes comparison unavailable at 30 days; stored data is removed on the next workspace visit (or a periodic check while the page remains open). On insufficient storage, an oversized workspace or an incomplete index, report why comparison is unavailable. Never silently truncate a baseline or interpret unreadable files as deletions. If persistence is blocked, a disclosed page-only baseline can still compare live source edits; reload cannot pretend that baseline survived. Ordinary source reading stays usable.

## Concrete comparison examples

| Recorded baseline → current source | Reader sees |
| --- | --- |
| `work.search` status `in-review` → `done` | Recorded status changed; no inferred acceptance |
| Criterion evidence gains a record | Recorded evidence changed, with current source link and before/after plain text |
| Decision options/rationale changes | Decision content changed; no invented new ruling |
| Unchanged source repeatedly touched | No content change; activity is not progress |
| New file after the baseline | Source added, with current source link |
| Known file absent from a complete current index | Source removed; old source remains readable as retained text |
| Same unique explicit item ID moves to another file | Source path changed for that item; compare its recorded content |
| Plain file moves without a durable identity | Show old path removed/new path added; no claimed rename or authorship |
| Duplicate item IDs at either observation | Do not choose an identity winner; disclose ambiguity |
| First visit, clear, expiry or corrupt storage | History unavailable; no invented additions or progress |
| One current file cannot be read | Comparison unavailable; no alleged removal |

The browser owns its baseline. A same-origin, loopback-only private POST query validates the versioned record and compares it with the current observation; it does not retain server history or write source files. Old and current source are escaped plain text, never rendered as executable Markdown assets. A snapshot is an observation of readable files, not an atomic filesystem transaction or a verified Git revision. Revisions used to detect source changes must not be confused with recorded Git evidence.
