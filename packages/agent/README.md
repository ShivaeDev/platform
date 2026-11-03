# @shivaedev/agent

Declare what your application needs from a coding agent before it submits work. Use one run vocabulary across coding backends while keeping each backend's supported features explicit.

## Ask for the behavior you need

A UI that needs steering should learn immediately when its configured backend cannot steer. Negotiation gives the application a typed facade or a failure describing the missing feature and the backend's available features.

```ts
import { Effect } from "effect";
import { requireFeatures } from "@shivaedev/agent/agent.ts";

const steer = Effect.gen(function* () {
	const agent = yield* requireFeatures(["steering"]);
	const receipt = yield* agent.start({
		operationId: "change-42",
		cwd: "/project",
		input: { parts: [{ type: "text", text: "Add a search field" }] },
	});
	yield* agent.steering.steer(receipt, {
		parts: [{ type: "text", text: "Keep the public API" }],
	});
});
```

## Working with runs

Install with `pnpm add @shivaedev/agent effect`. Supply the configured backend as the `Backend` service from `@shivaedev/agent/backend.ts`, normally through the backend adapter's Layer. Run the application's operation inside an Effect scope. The adapter owns its process and connection lifecycle; this package starts no processes and stores no events.

`requireFeatures` reads `Backend` from the Effect environment. It checks every requirement before returning a facade, without invoking any backend operation. `UnsupportedCapability` names the configured backend, the unmet requirement and its serialisable descriptor. The returned type exposes only the requested optional features. `requireFeatures([])` exposes the run port alone. `describe` reads the same descriptor without negotiating or calling the provider.

### Acceptance and recovery

The caller chooses an operation ID before submission and keeps it across recovery. `start` returns a `Receipt` acknowledging acceptance, with the backend name, operation ID, a versioned opaque backend reference and an optional session reference. It does not wait for completion. Treat references as adapter-owned values; their version belongs to that adapter's encoding.

`inspect(receipt)` returns either a known execution state or missing evidence with a reason. An unavailable or malformed read fails in the Effect error channel. A missing record does not establish that work failed or was never accepted.

After an ambiguous start, call `reconcile(operationId)`. Its answer is an existing receipt, authoritative proof of non-acceptance, or uncertainty. Reconciliation only reads evidence: the facade delegates to the backend's reconcile operation and never calls start as a fallback. The adapter must obey the same contract; absence from a partial history is uncertainty. The application decides what to do with that uncertainty.

### Features are separate implementations

Each `ConfiguredBackend` implements `start`, `inspect`, `reconcile` and `events`, and declares every feature as either `{ support: "supported", implementation }` or `{ support: "unsupported", reason }`. The serialisable descriptor omits implementations. Support describes the installed and configured backend, not a provider brand's theoretical abilities.

| Requirement    | Facade member                       | Meaning                                 |
| -------------- | ----------------------------------- | --------------------------------------- |
| `sessions`     | `sessions.resume(session, request)` | Submit a new run in an existing session |
| `queuedInput`  | `queuedInput.queue(receipt, input)` | Queue text input                        |
| `steering`     | `steering.steer(receipt, input)`    | Steer active work                       |
| `interruption` | `interruption.interrupt(receipt)`   | Request interruption                    |
| `transcript`   | `transcript.read(receipt)`          | Read a complete or partial transcript   |
| `imageInput`   | `imageInput.start(request)`         | Start with text and image parts         |
| `models`       | `models.list`                       | Read model choices and effort options   |

Steering dispatches only to steering, never to queueing. An unsupported transcript read is a negotiation failure, not an empty transcript. The ordinary start and input methods accept text; images use the explicitly requested image input feature. A backend can reject a particular request even when it supports the feature.

### Event and failure vocabulary

`RunEvent` in `@shivaedev/agent/events.ts` describes acknowledgements, execution, messages with text/image/native parts, thinking, tools, approval requests, usage, cost, model changes, child lineage, rate limits, background tasks, raw events and gaps. Native parts and raw events retain provider payloads as strings. Adapters wrap unfamiliar provider events as `raw`, preserving source, kind and payload rather than discarding them. This package defines the shared Schema; provider event translation belongs to the adapter.

Usage marks delta or cumulative scope and the run, turn or session it describes. Unreported token fields stay absent. Cost is a separate event with its currency and provider or estimated source; unreported cost stays absent. A transcript marks completeness explicitly, with gap events describing missing evidence. The application owns any journal, accounting aggregation, approval policy and approval response integration.

`BackendFailure` in `@shivaedev/agent/failures.ts` distinguishes `Rejected`, `BackendUnavailable`, `ProtocolFailure` and `UnknownAcceptance`, preserving optional provider codes. A definite refusal is `Rejected`. Unavailable means the backend cannot serve the operation; protocol failure means its response cannot be interpreted. During submission, if either situation leaves acceptance ambiguous, the adapter must return `UnknownAcceptance` with the original operation ID instead. Read operations use only unavailable or protocol failures. Scope cancellation stays native Effect interruption.

The package supplies a port and negotiation, not backend adapters, persistence or an event journal. Its scripted story kit proves the shared facade contract; it does not establish provider integration behavior.
