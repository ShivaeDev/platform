# @shivaedev/agent-claude-code

Run Claude Code through Platform's shared agent port. Keep native sessions, queued input and mid-turn steering while consuming the same Effect events as other agent backends.

## Claude sessions in an Effect scope

An application can continue a native Claude session and steer its active work without translating provider messages itself.

```ts
import { Effect } from "effect";
import { requireFeatures } from "@shivaedev/agent/agent.ts";
import { claudeCodeLayer } from "@shivaedev/agent-claude-code/claudeCode.ts";

const work = Effect.gen(function* () {
	const agent = yield* requireFeatures(["sessions", "steering"]);
	const receipt = yield* agent.start({
		operationId: "build-search",
		cwd: "/project",
		input: { parts: [{ type: "text", text: "Build search" }] },
	});
	yield* agent.steering.steer(receipt, {
		parts: [{ type: "text", text: "Keep the public API" }],
	});
});

const program = work.pipe(Effect.scoped, Effect.provide(claudeCodeLayer()));
```

## Working with the adapter

`claudeCodeLayer(options)` provides the shared `Backend` service. Each start belongs to the caller's Effect scope, which closes the query and rejects input that Claude has not pulled. `start` acknowledges a native session identity; it does not wait for the turn to finish. Consume `agent.events(receipt)` while the scope is open. Native scope cancellation remains Effect interruption.

The adapter declares sessions, queued input, steering, interruption and transcript reads as supported. Image input and model discovery are unsupported. Pass a model directly in `StartRequest.model`; `effort` accepts `low`, `medium`, `high`, `xhigh` or `max`. Invalid effort is rejected before dispatch.

`queuedInput.queue` sends an ordinary SDK user message. `steering.steer` sends priority `now`. Both finish when the provider pulls that input; neither claims the model has acted on it. `interruption.interrupt` requests interruption through the active SDK query. A subsequent provider result determines the observed outcome.

### Sessions and evidence

Keep the receipt's `session` reference to call `sessions.resume(session, request)` with a new operation ID. The reference contains Claude's native session ID, versioned by this adapter. Working directories are resolved to absolute paths for the SDK and transcript recovery. The mirror's load returns `null`, allowing Claude to resume from its own local transcript.

Receipts, event replay and transcript snapshots live only in the backend instance. `reconcile(operationId)` returns an observed acknowledgement or uncertainty; it never submits replacement work. `inspect` returns missing evidence for an operation this instance does not know. Persisting receipts, application agent identity, runner logs, wakeups and durable history belongs to the application.

`transcript.read` reconciles live SDK frames, session-store mirrors and subagent transcript repair into one event history. Provider UUIDs distinguish messages even when their text is identical. Workflow nodes retain their agent ID and spawning call, including identities learned after their first output. Repair runs after natural stream completion and reads provider transcripts; host teardown does not run a repair census.

Recovered missing output, unreadable recovery sources, spilled tool previews and a stream ending without a terminal turn result produce explicit `gap` events. A snapshot with a gap is `partial`. Spilled files are named, not read automatically. Unknown SDK frames remain `raw` events, and mapped events retain their provider payload. Usage and cost are separate events with per-turn deltas from the SDK's cumulative model totals; missing accounting stays absent.

### Application tools

Configure MCP tool bindings once on the backend. A tool callback returns an Effect with its dependencies already provided. Tool call IDs are scoped to this MCP server instance; they are not application agent identities.

```ts
import { Effect } from "effect";
import { claudeCodeLayer } from "@shivaedev/agent-claude-code/claudeCode.ts";

const backend = claudeCodeLayer({
	tools: [
		{
			name: "lookup",
			description: "Look up an item",
			inputSchema: { properties: { name: { type: "string" } } },
			call: (args, callId) => Effect.succeed({ text: "Found the item", ok: true }),
		},
	],
});
```

Bindings are served under `mcp__platform__<name>`. `ClaudeOptions` in `options.ts` also accepts an executable path, a local skills plugin path and a system prompt. A supplied system prompt disables the ambient settings and built-in tool set; configured MCP tools remain available. The default permission mode is Claude's `auto`; application approval-response integration is not provided by the shared port.

### Installation and provider boundary

Install `@shivaedev/agent-claude-code`, `@shivaedev/agent`, `effect` and `@anthropic-ai/claude-agent-sdk`. Install `@modelcontextprotocol/sdk` when binding tools. Both SDKs are optional peers, with exact compatible pins in the package manifest. Importing the package does not load either SDK; the live Layer loads Claude's SDK and tool binding loads the MCP SDK.

`makeClaudeBackend(options)` constructs the same adapter from `ClaudeProvider` in `adapters/ClaudeProvider.ts`. That boundary speaks the SDK query, message and transcript protocols, enabling scripted-provider stories without replacing the adapter. These stories establish adapter behavior; live authentication, executable compatibility and provider smokes belong to application adoption.
