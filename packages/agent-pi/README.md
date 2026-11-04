# @shivaedev/agent-pi

Run Pi through the shared Effect agent port. Keep Pi's embedded sessions and provider events while applications use the same acceptance, input and lifecycle vocabulary across backends.

## Pi sessions with an Effect lifetime

Submit work without waiting for the model to finish, then steer it through the negotiated agent facade. Closing the scope aborts and disposes the embedded session.

```ts
import { Effect } from "effect";
import { requireFeatures } from "@shivaedev/agent/agent.ts";
import { pi } from "@shivaedev/agent-pi/pi.ts";

const work = Effect.gen(function* () {
	const agent = yield* requireFeatures(["steering"]);
	const receipt = yield* agent.start({
		operationId: "search-field",
		cwd: "/project",
		input: { parts: [{ type: "text", text: "Add a search field" }] },
	});
	yield* agent.steering.steer(receipt, {
		parts: [{ type: "text", text: "Keep the public API" }],
	});
}).pipe(Effect.provide(pi()), Effect.scoped);
```

## Working with Pi

`pi(options?)` supplies the `Backend` Layer from `@shivaedev/agent/backend.ts`. Build it once for an application lifetime, and call `start` or `sessions.resume` inside a scope that lasts as long as the run. Each submission opens an embedded SDK session. A failed start releases that session before returning. Consume events until the execution outcome you need, then close the run scope. Pi owns its native session files; the application owns storing receipts, runner identity, logs, storage and wake policy.

### Acceptance, events and recovery

A receipt acknowledges Pi's `started`, `queued` or `handled` disposition, independently of its prompt promise. A handled initial prompt completes without a run; handled or queued input leaves an active run open. A prompt promise rejected before any disposition becomes `Rejected`, matching Pi's own RPC refusal signal. Resolution without a disposition becomes `UnknownAcceptance` with the submitted operation ID. Reconciliation returns remembered acceptance or refusal evidence within this backend instance; unknown IDs remain uncertain because Pi has no operation-ID lookup. An operation ID cannot be submitted twice to the same backend instance.

The version-one session reference contains the native session-file path. Save `receipt.session`, close its prior run scope, then pass it with a new start request to `agent.sessions.resume`; the adapter opens that file through `SessionManager.open`, preserving its native history. An unavailable file fails with `BackendUnavailable` before submission rather than silently creating replacement history. An unsupported reference version fails with `ProtocolFailure`. References do not contain application agent identities.

`events(receipt)` is a live, single-consumer stream buffered from subscription until the run scope closes. It includes the session-file reference, acknowledgement, execution state, settled user and assistant messages, thinking, tool calls and results, turn token deltas and separate provider USD cost deltas. Raw payloads preserve the complete provider event. Unmapped events, including retry and compaction notifications, remain `raw` events. An `agent_end` stays raw while the run remains open. At `agent_settled`, final assistant stop reasons distinguish completed, failed and interrupted runs, and `aborted` always reports interruption.

`inspect` reads execution evidence from the live session; after its scope closes it returns missing evidence. This is not a persisted run monitor or a transcript reader. Interruption calls Pi's abort; the scope finalizer unsubscribes, aborts and disposes even if abort fails.

### Configuration and input

`PiOptions` in `@shivaedev/agent-pi/PiOptions.ts` accepts `skills` (additional skill directory paths), and `constrainedPrompt`. Ordinary sessions retain Pi's discovered resources and add those skills. A constrained prompt disables discovered context files, extensions, templates, skills and themes, and supplies an empty tool allowlist. Custom tool registration is not implemented by this adapter.

Start requests accept an optional `provider/model-id` and thinking effort. Model listing and selection use `ModelRuntime.getAvailable`, so only models available with credentials participate. With no model, the first available model is selected and listed as the default. Supported thinking levels are `off`, `minimal`, `low`, `medium`, `high`, `xhigh` and `max`; other values are rejected before opening a session.

`queuedInput.queue` uses Pi's `followUp` delivery; `steering.steer` uses `steer`. Text parts join with newlines. `interruption`, `sessions`, `queuedInput`, `steering` and `models` are supported. `imageInput` and `transcript` are explicitly unsupported and fail capability negotiation.

### Installation and limits

```sh
pnpm add @shivaedev/agent-pi @shivaedev/agent effect @earendil-works/pi-coding-agent
```

The Pi coding-agent SDK is an optional peer loaded when a provider operation needs it. Importing the package or building its Layer does not require it. Without the peer, provider operations fail with `BackendUnavailable`. Installing this package does not install another backend's SDK.

The scripted SDK story kit proves adapter protocol wiring, acceptance, file-backed resume and disposal without a live model. It does not establish live provider integration; live smokes belong to the application's adoption.
