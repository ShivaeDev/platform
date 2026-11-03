import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { claude } from "#test/claudeStory.ts";
import { NATIVE_SESSION } from "#test/frames.ts";

claude.it(
	"start acknowledges the native session before completion and sends text to a canonical working directory",
	[],
	function* ({ start, inputs, requests, canonical }) {
		const cwd = yield* canonical("project");

		const receipt = yield* start("Build the app");

		expect(receipt).toMatchObject({ operationId: "build", session: { value: NATIVE_SESSION, version: 1 } });
		yield* outcomes([
			["provider input", () => inputs(), [{ message: { content: "Build the app", role: "user" } }]],
			["working directory", () => requests(), [{ cwd, effort: "provider default", resume: "new session" }]],
		]);
	},
);
claude.it("ordinary input has no priority while steering carries priority now", [], function* ({ start, queue, steer, inputs }) {
	yield* start();

	yield* queue("After this turn");
	yield* steer("Change direction now");

	const sent = yield* inputs();
	expect(sent[1]).toMatchObject({ message: { content: "After this turn" } });
	expect(sent[1]).not.toHaveProperty("priority");
	expect(sent[2]).toMatchObject({ message: { content: "Change direction now" }, priority: "now" });
});
claude.it("resume sends the native identity back to Claude", [], function* ({ resume, requests }) {
	const receipt = yield* resume(NATIVE_SESSION);

	expect(receipt.session).toEqual({ value: NATIVE_SESSION, version: 1 });
	expect(yield* requests()).toMatchObject([{ resume: NATIVE_SESSION }]);
});
claude.it("interruption reaches the active provider query", [], function* ({ start, interrupt, counters }) {
	yield* start();

	yield* interrupt();

	expect(yield* counters()).toMatchObject({ interrupted: 1 });
});
claude.it(
	"reconciliation uses the acknowledgement and leaves missing operations uncertain without new queries",
	[],
	function* ({ start, reconcile, requests }) {
		const receipt = yield* start();
		const sent = yield* requests();

		yield* outcomes([
			["acknowledgement", () => reconcile("build"), { receipt, type: "accepted" }],
			["missing operation", () => reconcile("missing"), { operationId: "missing", type: "uncertain" }],
			["provider queries", () => requests(), sent],
		]);
	},
);

claude.it("an unknown effort is rejected before provider dispatch", [], function* ({ rejectEffort, requests }) {
	const outcome = yield* rejectEffort("turbo");

	expect(outcome).toEqual({ outcome: "rejected", reason: "Unsupported Claude effort: turbo" });
	expect(yield* requests()).toEqual([]);
});
