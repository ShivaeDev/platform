# @shivaedev/agent-opencode

Run OpenCode through Platform's shared agent port. Applications use the same Effect lifecycle, receipts and events while the adapter owns OpenCode's HTTP protocol, event mapping and delivery queue.

## Keep application work on the shared port

Start a run, steer active work or queue the next instruction without putting provider transport in the application.

```ts
import { Effect } from "effect";
import { requireFeatures } from "@shivaedev/agent/agent.ts";
import { opencode } from "@shivaedev/agent-opencode/opencode.ts";

const program = Effect.gen(function* () {
	const agent = yield* requireFeatures(["steering"]);
	const run = yield* agent.start({
		operationId: "search",
		cwd: "/project",
		input: { parts: [{ type: "text", text: "Add search" }] },
	});
	yield* agent.steering.steer(run, {
		parts: [{ type: "text", text: "Keep the public API" }],
	});
}).pipe(Effect.provide(opencode({ cwd: "/project" })), Effect.scoped);
```

## Using it

`opencode(options)` is a Layer for `Backend` from `@shivaedev/agent/backend.ts`. It starts one OpenCode server for the Layer's scope. Provide `ChildProcessSpawner` from your platform runtime, for example `NodeServices.layer` from `@effect/platform-node/NodeServices`, to the Layer. The scope of each start or resume keeps its session subscriptions, queued deliveries and tool handlers alive.

Set `url` to connect to an existing server instead. This mode uses HTTP requests and the global SSE endpoint; Session tool bridging is unsupported in this mode; use a spawned server for direct tools. `command` selects the executable when spawning and defaults to `opencode`. `cwd` is the process directory; each start's `cwd` is sent as the provider request's `directory` query. `skills` optionally sets an OpenCode skills path for spawned servers.

### Runs and delivery

Start creates a session; `sessions.resume` reads an existing session before sending the new input. Receipts carry version 1 OpenCode session references. Start acknowledges `prompt_async` delivery, without waiting for model completion. Model names use `provider/model`; `effort` selects the provider's variant. Omitting the model lets OpenCode choose. `models.list` reads provider names, defaults and variants from `/config/providers`.

Queued input waits locally until `session.idle`, then sends one input at a time in arrival order. The queue operation completes when the provider accepts its delivery. Steering sends `prompt_async` immediately, including while a turn is active. Interruption sends the session's abort request; the request acknowledgement alone is not proof of an interrupted turn.

Events are session scoped and consumed as a single live stream per receipt. Message metadata associates parts with their author; only settled text and reasoning parts become shared messages. Settled parts and tool transitions are deduplicated. Unknown events retain their raw provider payload. Token usage and provider cost are separate events; missing accounting fields stay absent. A busy turn followed by idle reports completion, failure or interruption from the provider's turn evidence.

`inspect` reports observed live execution evidence. `reconcile` returns receipts acknowledged by this Layer, and uncertainty otherwise. OpenCode has no operation-ID lookup, so a restart or a lost submission acknowledgement cannot establish non-acceptance. Ambiguous prompt delivery fails with `UnknownAcceptance`; reconciliation never resubmits it. The application owns durable storage, wake scheduling, logs and agent identity.

### Session tools

`tools` supplies the catalogue of direct tools. Each tool has `name`, `description`, an object `inputSchema`, and `call(callId, args)`, returning an Effect with `{ ok, text }`. Optional `sessionTools(request)` binds a subset and its handlers to each start or resume. Use it to capture application context for that session; tool execution receives the provider's call ID and arguments with routing fields removed.

A spawned server gets the MCP endpoint and caller-session plugin automatically. The plugin stamps `callerSession` and `callerCall` on `platform_` tool calls. The bridge dispatches only to that open session's assigned tool and keeps calls within its scope. Native OpenCode tools remain available by default; other catalogue tools are denied. With `constrainedPrompt`, permissions deny everything first and then allow only assigned bridge tools, because OpenCode uses the last matching rule. Constrained mode also disables project config, external skills and Claude Code prompts.

### Install and limits

```sh
pnpm add @shivaedev/agent-opencode @shivaedev/agent effect @effect/platform-node
pnpm add @modelcontextprotocol/sdk
```

The OpenCode executable and its provider credentials are runtime prerequisites. The MCP SDK is an optional peer used only when spawning with tools. A connection without tools does not import it. Node platform support is an optional peer used for spawned tool endpoints; process spawning uses the runtime's native Effect process service.

Supported shared features are sessions, queued input, steering, interruption and model discovery. Image input and transcript history are explicitly unsupported. Approval responses, child lineage and image projection have no normalized implementation; unfamiliar provider events remain raw. Events and queues do not survive a backend restart, and an SSE disconnect supplies no completion evidence. There is no reconnect or automatic replacement run. Existing sessions retain their provider permissions when resumed.

The scripted peer exercises the real adapter's HTTP, SSE and MCP boundaries. Live provider validation belongs to application adoption.
