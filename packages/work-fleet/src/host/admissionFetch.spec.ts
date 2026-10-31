import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { fetchingMain } from "#test/fetchingMain.ts";
import { approvedWork, host } from "#test/hostStory.ts";

host.it(
	"admission waits for another daemon read of main to finish its fetch and then queues work on the pushed revision",
	[approvedWork(["one"]), fetchingMain],
	function* (daemon) {
		const reading = yield* daemon.heldMainRead();
		const admission = yield* daemon.admissionDuringHeldFetch(daemon.admit());
		yield* daemon.externalMainFetch();

		daemon.releaseMainFetch();

		yield* outcomes([
			["main read", () => reading.revision(), daemon.pushedMainRevision()],
			["admission warnings", () => admission.result(), []],
			["one", () => daemon.get("one"), { preparation: { baseRevision: daemon.pushedMainRevision() }, step: "queued" }],
		]);
		expect(daemon.mainFetchesOverlapped()).toBe(false);
	},
);

host.it("admission retries when an external fetch advances its expected main ref", [approvedWork(["one"]), fetchingMain], function* (daemon) {
	const admission = yield* daemon.admissionHoldingFetch(daemon.admit());
	yield* daemon.externalMainFetch();

	daemon.releaseMainFetch();

	yield* outcomes([
		["admission warnings", () => admission.result(), []],
		["one", () => daemon.get("one"), { preparation: { baseRevision: daemon.pushedMainRevision() }, step: "queued" }],
	]);
});

host.it(
	"admission against an unreachable Git remote is unavailable and names the failed fetch",
	[approvedWork(["one"]), fetchingMain],
	function* (daemon) {
		const failure = yield* daemon.unreachableRemoteAdmission(daemon.admit());

		expect(failure).toMatch(
			/^unavailable: git fetch failed: Command failed: git fetch --quiet origin main[\s\S]*unreachable\.git[\s\S]*does not appear to be a git repository/u,
		);
	},
);
