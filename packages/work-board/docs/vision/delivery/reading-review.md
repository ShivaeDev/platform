---
id: investigation.work-board-reading
kind: investigation
next_action: Review the remaining reader limits and D2 write examples before wave 2.
criteria:
  - id: representative-reader
    text: A representative returning reader finds the next judgment unaided.
  - id: write-boundary
    text: The maintainer settles the first durable response and source-write boundary.
attention:
  - id: reading-review
    kind: review
    state: open
    response_from: [maintainer]
    reason: Automated reading checks passed; representative-reader orientation is still unmeasured.
    unblocks: [investigation.work-board-reading#representative-reader]
  - id: d2
    kind: decision
    state: open
    response_from: [maintainer]
    reason: Choose the first response format and safe write boundary before step 14.
    unblocks: [investigation.work-board-reading#write-boundary]
---
# Reading workflow review

This is an actual project investigation, read through the same Work Board as the
project brief and delivery roadmap. It records implementation observations and
asks for the remaining human judgments. Neither criterion above is accepted by
the automated checks below. Source remains authoritative; the app has no writer.

## Recorded technical observations

Chromium 151 exercised the actual [project brief](../README.md) and
[wave 1 plan](./wave1.md), served through an explicitly linked reference folder.
Desktop 1440×1000 and narrow 390×844 dark/reduced-motion layouts retained readable
documents, source links and components; the keyboard skip link reached the main
content. The wave 1 plan also remained readable without JavaScript.

A separate 50-document/100-item fixture exercised search, favorites and duplicate
heading passages, an external edit while paused, resume, offline updates followed
by reconnect, open-details retention, file rename/delete, and malformed YAML with
readable body text. These are browser and fixture observations, not a timed
representative-reader study or proof of physical-device adoption.

Real HTTP embedding regression composes `boardLayer` with an application's
`/health` route on the same Effect server. Both routes work; Work Board's page and
asset loopback guards remain scoped to its routes; disposing the application
scope closes the listening server. Existing packed-consumer checks remain part
of the repository handoff.

The full repository handoff passed: 1,195 package passes, four expected failures,
one intentional skip, 241 Work Board tests, seven orchestration checks, real
PostgreSQL and all packed consumers. The quality baseline remained 2,547. This
investigation's two explicitly authored requests appeared in the actual browser
Overview, without inferring a response or acceptance from those checks.

## First performance observations

Measured on 2026-10-06, Node 24.19.0, Linux 6.18.44, AMD EPYC 9V74, five logical
CPUs, 18 GiB RAM. Five fresh servers ran sequentially in one process with warm
process/filesystem caches, loopback HTTP and no concurrent repository handoff.
The source was the existing 50-document/100-item workspace fixture. Each sample
read the first complete HTML response, queried search after that render warmed
the index, then edited one note and polled search every 25 ms until it appeared.

| Sample | First complete HTML (ms) | Warm search (ms) | Edit to searchable result (ms) |
| --- | ---: | ---: | ---: |
| 1 | 407.9 | 5.2 | 244.6 |
| 2 | 270.2 | 3.4 | 162.9 |
| 3 | 233.6 | 3.1 | 193.8 |
| 4 | 224.6 | 2.7 | 185.4 |
| 5 | 214.7 | 2.5 | 166.4 |

These observations are not cold-start/cold-search measurements, browser paint or
interaction latency, a p95, or an agreed performance budget. The edit observation
includes watcher debounce and polling. Record a broader reference workload and
agree thresholds before enforcing a performance gate; no numerical gate was
invented from these five samples.

## Remaining judgments and limits

- Step 07's representative-reader 30-second orientation target is still unmeasured.
  A maintainer should return to real changed notes, find the next requested
  judgment without coaching, and report what was confusing. Automated fixtures
  cannot supply that observation.
- Physical tab/Capacitor adoption and actual browser back-forward cache restoration
  remain unestablished; persisted-pageshow DOM checks do not prove bfcache use.
- Contrast was inspected in actual light/dark browser layouts; this is not a
  complete accessibility audit or an assistive-technology user study.
- First-render/search/update figures are observations, not accepted budgets.
- D2 remains open. Review [the concrete write examples](./response-write-examples.md)
  before implementing any mutation. Export and portable review packets remain
  outside all project scope; reports and this investigation are ordinary documents.

Wave 1's technical reading review can be assessed independently of these open
human acceptance questions. Do not mark the representative-reader criterion or
the whole wave accepted merely because repository and browser checks pass.
