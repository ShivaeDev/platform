import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { claude } from "#test/claudeStory.ts";
import { assistant, NATIVE_SESSION, stamp } from "#test/frames.ts";
import { result } from "#test/result.ts";

claude.it(
	"cumulative model totals become separate per-turn usage and cost deltas across a counter reset",
	[],
	function* ({ start, frame, transcript }) {
		yield* start();
		yield* frame(result(10));
		yield* frame(result(14));
		yield* frame(result(3));
		const events = (yield* transcript()).events;
		expect(events.filter((event) => event.type === "usage")).toMatchObject([
			{ inputTokens: 10, model: "claude-sonnet", outputTokens: 10, scope: "delta", unit: "turn" },
			{ inputTokens: 4, outputTokens: 4 },
			{ inputTokens: 3, outputTokens: 3 },
		]);
		expect(events.filter((event) => event.type === "cost")).toMatchObject([
			{ amount: 0.1, currency: "USD", scope: "delta", unit: "turn" },
			{ amount: expect.closeTo(0.04) },
			{ amount: 0.03 },
		]);
	},
);
claude.it("a provider result reporting aborted streaming is observed as interrupted", [], function* ({ start, frame, inspect }) {
	yield* start();
	yield* frame(result(0, "aborted_streaming"));
	expect(yield* inspect()).toEqual({ state: "interrupted", type: "known" });
});
claude.it("thinking and MCP tool calls retain provider names and raw payloads", [], function* ({ start, frame, transcript }) {
	yield* start();
	const message = assistant("unused");
	yield* frame({
		...message,
		message: {
			...message.message,
			content: [
				{ signature: "sig", thinking: "Plan", type: "thinking" },
				{ id: "call", input: { name: "item" }, name: "mcp__platform__lookup", type: "tool_use" },
			],
		},
	});
	const events = (yield* transcript()).events;
	expect(events).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ text: "Plan", type: "thinking" }),
			expect.objectContaining({
				input: '{"name":"item"}',
				name: "lookup",
				providerName: "mcp__platform__lookup",
				raw: expect.objectContaining({ payload: expect.stringContaining("mcp__platform__lookup"), source: "claude" }),
				toolId: "call",
				type: "tool.started",
			}),
		]),
	);
});
claude.it("session state and background task frames reach the shared lifecycle vocabulary", [], function* ({ start, frame, transcript, inspect }) {
	yield* start();
	yield* frame({ "session_id": NATIVE_SESSION, state: "requires_action", subtype: "session_state_changed", type: "system", uuid: stamp() });
	yield* frame({
		"session_id": NATIVE_SESSION,
		subtype: "background_tasks_changed",
		tasks: [{ description: "Build", "task_id": "build", "task_type": "local_bash" }],
		type: "system",
		uuid: stamp(),
	});
	yield* outcomes([
		["execution", () => inspect(), { state: "awaiting-input", type: "known" }],
		[
			"background tasks",
			() => transcript(),
			{
				events: expect.arrayContaining([
					expect.objectContaining({ tasks: [{ description: "Build", id: "build", kind: "local_bash" }], type: "session.background" }),
				]),
			},
		],
	]);
});

claude.it("a terminal provider result completes the run without transcript gaps", [], function* ({ start, frame, finish, inspect, transcript }) {
	yield* start();
	yield* frame(result(3));

	yield* finish();

	yield* outcomes([
		["execution", () => inspect(), { state: "completed", type: "known" }],
		[
			"transcript",
			() => transcript(),
			{ completeness: "complete", events: expect.arrayContaining([expect.objectContaining({ state: "completed", type: "execution" })]) },
		],
	]);
	const events = (yield* transcript()).events;
	expect(events.filter((event) => event.type === "gap")).toEqual([]);
});
