import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boundTool, claude, missingAcknowledgement } from "#test/claudeStory.ts";

claude.it("queued delivery waits for the provider to pull input", [], function* ({ start, beginQueue, queueStatus, pullInput, inputs }) {
	yield* start();
	yield* beginQueue("Next turn");
	expect(yield* queueStatus()).toBe("waiting");

	yield* pullInput();

	yield* outcomes([
		["delivery", () => queueStatus(), "accepted"],
		["provider input", () => inputs(), [{ message: { content: "Build the app" } }, { message: { content: "Next turn" } }]],
	]);
});
claude.it(
	"scope closure closes the query and rejects undelivered input",
	[],
	function* ({ start, beginQueue, close, queueStatus, queueOutcome, counters }) {
		yield* start();
		yield* beginQueue("Not pulled");
		expect(yield* queueStatus()).toBe("waiting");

		yield* close();

		yield* outcomes([
			["query lifecycle", () => counters(), { census: 0, closed: 1 }],
			["pending delivery", () => queueOutcome(), "session closed before delivery reached the provider"],
		]);
	},
);
claude.it(
	"a missing native acknowledgement leaves acceptance uncertain without replacement work",
	[missingAcknowledgement],
	function* ({ beginStart, endProvider, startOutcome, reconcile, requests }) {
		yield* beginStart();
		const sent = yield* requests();

		yield* endProvider();

		yield* outcomes([
			["acceptance", () => startOutcome(), { operationId: "lost-ack", outcome: "unknown acceptance" }],
			["reconciliation", () => reconcile("lost-ack"), { operationId: "lost-ack", type: "uncertain" }],
			["provider queries", () => requests(), sent],
		]);
	},
);
claude.it(
	"a failed provider stream exposes the failure and leaves an explicit transcript gap",
	[],
	function* ({ start, failProvider, readFailure, transcript }) {
		yield* start();
		yield* failProvider();
		expect(yield* readFailure()).toContain("provider connection lost");
		const result = yield* transcript();
		expect(result.completeness).toBe("partial");
		expect(result.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ detail: expect.stringContaining("provider connection lost"), kind: "provider-unavailable", type: "gap" }),
			]),
		);
	},
);
claude.it(
	"the provider calls an application tool through its bound MCP server and receives its output",
	[boundTool],
	function* ({ start, tool, toolCalls }) {
		yield* start();
		const output = yield* tool("lookup", { name: "item" });
		expect(output).toMatchObject({ content: [{ text: "Found the item", type: "text" }], isError: false });
		expect(yield* toolCalls()).toEqual([{ args: { name: "item" }, callId: expect.stringMatching(/^[0-9a-f-]+:\d+$/u) }]);
	},
);
