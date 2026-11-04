import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { assistant } from "#test/assistant.ts";
import { piAgent } from "#test/piStory.ts";

piAgent.it("a retrying end retains evidence without reporting completion", [], function* ({ start, emit, events, inspect }) {
	yield* start("alice", "work");
	yield* emit("alice", { messages: [assistant("error")], type: "agent_end", willRetry: true });

	yield* outcomes([
		["execution evidence", () => inspect("alice"), { state: "running", type: "known" }],
		[
			"retry evidence",
			() => events("alice"),
			expect.arrayContaining([
				expect.objectContaining({
					raw: expect.objectContaining({ kind: "agent_end", payload: expect.stringContaining('"willRetry":true') }),
					type: "raw",
				}),
			]),
		],
	]);
});

for (const [reason, state] of [
	["stop", "completed"],
	["error", "failed"],
	["aborted", "interrupted"],
] as const) {
	piAgent.it(`a final ${reason} ending waits for Pi to settle before reporting ${state}`, [], function* ({ start, emit, settle, inspect, events }) {
		yield* start("alice", "work");
		yield* emit("alice", { messages: [assistant(reason)], type: "agent_end", willRetry: false });
		expect(yield* inspect("alice")).toEqual({ state: "running", type: "known" });

		yield* settle("alice");

		yield* outcomes([
			["execution evidence", () => inspect("alice"), { state, type: "known" }],
			["execution events", () => events("alice", "execution"), [{ state: "running" }, { state }]],
		]);
	});
}

piAgent.it("an aborted settlement cancels a run even after a successful agent end", [], function* ({ start, emit, settle, inspect, events }) {
	yield* start("alice", "work");
	yield* emit("alice", { messages: [assistant()], type: "agent_end", willRetry: false });

	yield* settle("alice", true);

	yield* outcomes([
		["execution evidence", () => inspect("alice"), { state: "interrupted", type: "known" }],
		["execution events", () => events("alice", "execution"), [{ state: "running" }, { state: "interrupted" }]],
	]);
});

piAgent.it("settled messages carry text, thinking, token deltas and separate provider cost", [], function* ({ start, emit, events }) {
	yield* start("alice", "work");
	yield* emit("alice", { message: { content: [{ text: "question", type: "text" }], role: "user", timestamp: 0 }, type: "message_end" });
	yield* emit("alice", { message: assistant(), type: "message_end" });

	expect((yield* events("alice")).filter((event) => ["message", "thinking", "usage", "cost"].includes(event.type))).toMatchObject([
		{ parts: [{ text: "question", type: "text" }], role: "user", type: "message" },
		{ text: "weighing it", type: "thinking" },
		{ parts: [{ text: "all done", type: "text" }], role: "agent", type: "message" },
		{ cacheReadTokens: 3, cacheWriteTokens: 1, inputTokens: 11, model: "acme/fast", outputTokens: 5, scope: "delta", type: "usage", unit: "turn" },
		{ amount: 0.1, currency: "USD", model: "acme/fast", scope: "delta", source: "provider", type: "cost", unit: "turn" },
	]);
});

piAgent.it("tool events retain call arguments, text output and failure status", [], function* ({ start, emit, events }) {
	yield* start("alice", "work");
	yield* emit("alice", { args: { path: "README.md" }, toolCallId: "call-1", toolName: "read", type: "tool_execution_start" });
	yield* emit("alice", {
		isError: true,
		result: {
			content: [
				{ text: "first", type: "text" },
				{ text: "second", type: "text" },
			],
		},
		toolCallId: "call-1",
		toolName: "read",
		type: "tool_execution_end",
	});

	expect((yield* events("alice")).filter((event) => event.type.startsWith("tool."))).toMatchObject([
		{ input: '{"path":"README.md"}', name: "read", toolId: "call-1", type: "tool.started" },
		{ ok: false, output: "first\nsecond", toolId: "call-1", type: "tool.completed" },
	]);
});

piAgent.it("unmapped provider events reach consumers as complete raw payloads", [], function* ({ start, emit, events }) {
	yield* start("alice", "work");
	yield* emit("alice", { reason: "overflow", type: "compaction_start" });

	expect((yield* events("alice")).find((event) => event.raw?.kind === "compaction_start")).toEqual({
		raw: { kind: "compaction_start", payload: '{"reason":"overflow","type":"compaction_start"}', source: "pi" },
		type: "raw",
	});
});
