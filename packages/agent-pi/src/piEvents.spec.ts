import { expect } from "@effect/vitest";
import { assistant } from "#test/piEvents.ts";
import { pi } from "#test/piStory.ts";

pi.it("assistant messages convert thinking, text, token usage and provider cost", [], function* ({ start, emit, events }) {
	yield* start();

	yield* emit({ message: assistant(), type: "message_end" });

	expect((yield* events(6)).slice(2)).toMatchObject([
		{ text: "Consider the API", type: "thinking" },
		{ parts: [{ text: "App is ready", type: "text" }], role: "agent", type: "message" },
		{ cacheReadTokens: 3, cacheWriteTokens: 1, inputTokens: 11, model: "sonnet", outputTokens: 5, scope: "delta", type: "usage", unit: "turn" },
		{ amount: 0.1, currency: "USD", model: "sonnet", scope: "delta", source: "provider", type: "cost", unit: "turn" },
	]);
});

pi.it("user messages and tool execution convert to shared events", [], function* ({ start, emit, events }) {
	yield* start();

	yield* emit({ message: { content: [{ text: "Read the file", type: "text" }], role: "user", timestamp: 0 }, type: "message_end" });
	yield* emit({ args: { path: "README.md" }, toolCallId: "read-1", toolName: "read", type: "tool_execution_start" });
	yield* emit({
		isError: false,
		result: {
			content: [
				{ text: "first", type: "text" },
				{ text: "second", type: "text" },
			],
			details: undefined,
		},
		toolCallId: "read-1",
		toolName: "read",
		type: "tool_execution_end",
	});

	expect((yield* events(5)).slice(2)).toMatchObject([
		{ parts: [{ text: "Read the file", type: "text" }], role: "user", type: "message" },
		{ input: '{"path":"README.md"}', name: "read", toolId: "read-1", type: "tool.started" },
		{ ok: true, output: "first\nsecond", toolId: "read-1", type: "tool.completed" },
	]);
});

pi.it("an unmapped Pi event survives with its full raw payload", [], function* ({ start, emit, events }) {
	yield* start();

	yield* emit({ type: "agent_settled" });

	expect((yield* events(3))[2]).toEqual({ raw: { kind: "agent_settled", payload: '{"type":"agent_settled"}', source: "pi" }, type: "raw" });
});

pi.it("event readers replay acceptance and then receive live provider events", [], function* ({ start, watch, emit, watchedEvents }) {
	const receipt = yield* start();
	yield* watch(3);

	yield* emit({ type: "agent_start" });

	expect(yield* watchedEvents()).toMatchObject([
		{ receipt, type: "acknowledged" },
		{ reference: receipt.session?.value, type: "session.opened" },
		{ state: "running", type: "execution" },
	]);
});

pi.it("disposing a runtime closes its live event readers", [], function* ({ start, watch, dispose, watchedEvents }) {
	yield* start();
	yield* watch();

	yield* dispose();

	expect(yield* watchedEvents()).toMatchObject([{ type: "acknowledged" }, { type: "session.opened" }]);
});
