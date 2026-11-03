# @shivaedev/agent-pi

Run Pi through Platform's shared agent port. Keep the same Effect lifecycle and input vocabulary while Pi owns its embedded coding session and persisted history.

## Pi with an application-owned lifecycle

An application can accept a run, queue another instruction, and close the runtime through its Effect scope. Acceptance does not wait for Pi to finish the work.

```ts
import { Effect } from "effect";
import { requireFeatures } from "@shivaedev/agent/agent.ts";
import { piLayer } from "@shivaedev/agent-pi/piLayer.ts";

const run = Effect.gen(function* () {
	const agent = yield* requireFeatures(["queuedInput"]);
	const receipt = yield* agent.start({
		cwd: process.cwd(),
		input: { parts: [{ type: "text", text: "Build the settings page" }] },
		operationId: "settings-page",
	});
	yield* agent.queuedInput.queue(receipt, {
		parts: [{ type: "text", text: "Include a dark theme" }],
	});
}).pipe(Effect.provide(piLayer()), Effect.scoped);
```

The application keeps the scope open while it needs the session. Closing it aborts Pi, detaches its event listener, and disposes the embedded runtime.

## Using the adapter

Provide `piLayer()` to `@shivaedev/agent` and negotiate the features your application needs with `requireFeatures`. The layer opens no SDK session until you start or resume a run. `piLayer({ additionalSkillPaths: ["/app/skills"] })` passes additional skill directories to Pi's resource loader; Pi keeps its normal resource discovery and built-in tools.

A start selects from Pi's credential-backed model catalog. Set `model` to `provider/model-id`, or omit it to use the first available model. `models.list` exposes that catalog. An optional `effort` must be one of `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, or `max`.

The receipt's `reference` identifies the runtime session; its `session` reference carries the persisted session-file path and reference version. Store the latter in your application to resume with `agent.sessions.resume(reference, request)`. Resume uses Pi's `SessionManager.open`, retaining the native file and its history. A missing session file is refused before submitting work. The shared scope owns each opened runtime, including resumed sessions.

Pi's successful preflight callback accepts input before the SDK's prompt promise completes. `queuedInput.queue` uses Pi's `followUp` delivery; `steering.steer` uses `steer`. `interruption.interrupt` calls Pi's abort without disposing the session. Preflight refusals and unavailable models fail with the shared typed backend errors.

`events(receipt)` replays the runtime's events and then follows live events until the reader stops or the runtime scope closes. Messages, thinking, tool executions, token usage and provider USD costs map to shared events. Usage and cost are turn deltas. A retrying `agent_end` remains raw and cannot mark execution complete. Unmapped event kinds, including Pi's settled notification, retain their full raw payload. Final `agent_end` reports completed, failed or interrupted from Pi's stop reason.

`inspect` reports the runtime's observed state, or missing evidence after disposal. `reconcile(operationId)` returns acceptance recorded in this layer instance. It returns uncertain when that evidence is absent, including after a restart; session files do not establish operation-id acceptance. Application storage, wake scheduling, logs and agent identity belong to the application.

### Install and limits

```sh
pnpm add @shivaedev/agent-pi @shivaedev/agent effect @earendil-works/pi-coding-agent
```

The Pi SDK is an optional peer, required when invoking Pi. Importing the layer and negotiating features works without loading it. This package does not install another agent backend's SDK.

Sessions, queued input, steering, interruption and model listing are supported. Image input and persisted transcript reads are explicitly unsupported and fail feature negotiation. The shared port exposes no custom tool registration or constrained system prompt configuration. Provider authentication and resource configuration follow Pi's SDK conventions. Live-provider verification belongs to the adopting application.
