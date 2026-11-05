# @shivaedev/agent-codex

Run local Codex sessions through the shared Effect agent port. Applications keep their own storage and identity while this adapter handles Codex's app-server protocol and submission recovery.

## One agent port for Codex

Negotiate the capabilities your application needs, then submit work with an operation ID you can reconcile if its acknowledgement is lost.

```ts
import { Effect } from "effect";
import { requireFeatures } from "@shivaedev/agent/agent.ts";

const program = Effect.gen(function* () {
	const agent = yield* requireFeatures(["transcript", "steering"]);
	const receipt = yield* agent.start({
		cwd: "/project",
		operationId: "change-42",
		input: { parts: [{ type: "text", text: "Implement the requested change" }] },
	});
	return yield* agent.inspect(receipt);
});
```

## Using the adapter

The Layer owns one local `codex app-server` process and provides its adapter engine as a service. `Codex` declares that engine once; its operations yield it from the environment and keep no dependency in initializer state. Applications provide only `codexLayer` and `CodexConfig`. Keep the caller's scope open for queued delivery and event observation. A receipt identifies a provider turn and its thread; acceptance does not mean completion. `inspect` and transcript reads query provider history without resuming a thread.

Provide the program above with the Codex Layer and its configuration:

```ts
import { Effect, Layer } from "effect";
import { CodexConfig } from "@shivaedev/agent-codex/config.ts";
import { codexLayer } from "@shivaedev/agent-codex/codexLayer.ts";

const live = codexLayer.pipe(Layer.provide(Layer.succeed(CodexConfig)({})));
await Effect.runPromise(program.pipe(Effect.scoped, Effect.provide(live)));
```

The backend declares sessions, queued input, steering, interruption, transcripts, native image input and model discovery as supported. Queued input waits locally for the active turn to complete. Steering includes the receipt's expected turn ID; an old receipt never redirects input to a newer turn. Interruption waits for the matching completion notification before queued delivery starts, including Codex's residual-draining rejection.

`operationId` becomes Codex's `clientUserMessageId`. A mutation timeout or unreadable acknowledgement yields `UnknownAcceptance`; `reconcile(operationId)` looks for the exact user-item `clientId`. Missing or duplicate evidence remains uncertain and never authorizes resubmission. Keep operation IDs stable when retrying. Recovery associations live only for the Layer's lifetime; recovery after application restart without a known thread association is unsupported. Persist receipts in the application.

`CodexConfig` accepts a command, arguments, process working directory, request timeout, sandbox, base instructions and dynamic tools. A tool supplies its name, description, JSON input schema and an Effect returning `{ ok, text }`. Tools are registered for the live root thread on start and resume. Tool inheritance by child threads is unsupported. Provider approval and interactive input consumers are unsupported; requests are declined. Cloud transport, remote endpoints, runner logs, wake scheduling, application storage and agent identity are outside this package.

Custom process adapters provide `ProcessSpawner` from `@shivaedev/agent-codex/adapters/process.ts` through a Layer. Its default spawns the configured local process; the adapter Layer releases the process when it closes.

Import `Codex` from `@shivaedev/agent-codex/codex/service.ts`, yield it from Effect's environment and call `census(rootThreadId)` to passively list descendants and claim their ownership. Child threads cannot be resumed because doing so changes their goals. Event mapping preserves item content, child attribution, rate-limit windows and raw frames when the shared vocabulary cannot express a provider item. Usage is provider-reported cumulative session usage; cost estimation is unsupported.

The initialize response is compared with the protocol's CLI pin and a mismatch is logged. Version drift is diagnostic, not protocol negotiation. Live provider validation belongs in the consuming application; scripted peers do not prove compatibility with a running provider.

Install with `pnpm add @shivaedev/agent-codex @shivaedev/agent effect`, install and authenticate the Codex CLI separately, then provide `CodexConfig` to `codexLayer`. No other backend SDK is required.
