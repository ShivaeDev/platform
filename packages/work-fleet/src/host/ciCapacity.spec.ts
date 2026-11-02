import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { ciCapacity } from "#test/ciCapacity.ts";

ciCapacity.it(
	"queued CI slows new workers at the upper threshold and speeds them up at the lower threshold, recording each tier",
	[],
	function* (daemon) {
		yield* daemon.dispatch("one");
		expect(daemon.launches()).toEqual(["fast"]);

		daemon.queuedRuns(5);
		yield* daemon.intervalPasses();
		yield* daemon.dispatch("two");

		yield* outcomes([
			["worker launches", () => Effect.sync(daemon.launches), ["fast", undefined]],
			["recorded fast launch", () => daemon.recordedTier("one"), "fast"],
			["recorded provider default launch", () => daemon.recordedTier("two"), undefined],
			["status", () => daemon.status(), { config: { settings: { concurrency: 100 } }, launchTier: { queuedRuns: 5, serviceTier: undefined } }],
		]);

		daemon.queuedRuns(2);
		yield* daemon.intervalPasses();
		yield* daemon.dispatch("three");

		yield* outcomes([
			["worker launches", () => Effect.sync(daemon.launches), ["fast", undefined, "fast"]],
			["recorded recovered launch", () => daemon.recordedTier("three"), "fast"],
			[
				"CLI status",
				() => daemon.cliStatus(),
				{ code: 0, stdout: expect.stringContaining("Service tier fast: 2 queued CI runs; provider default at >= 5, fast at <= 2") },
			],
		]);
	},
);

ciCapacity.it("CI counts between thresholds retain the tier on both sides of the hysteresis band", [], function* (daemon) {
	daemon.queuedRuns(4);
	yield* daemon.intervalPasses();
	yield* daemon.dispatch("one");
	expect(daemon.launches()).toEqual(["fast"]);

	daemon.queuedRuns(6);
	yield* daemon.intervalPasses();
	yield* daemon.dispatch("two");
	expect(daemon.launches()).toEqual(["fast", undefined]);

	daemon.queuedRuns(3);
	yield* daemon.intervalPasses();
	yield* daemon.dispatch("three");

	expect(daemon.launches()).toEqual(["fast", undefined, undefined]);
});

ciCapacity.it("launches and status share one queued-run read per daemon interval", [], function* (daemon) {
	expect(daemon.requests()).toEqual(["repos/example/project/actions/runs?status=queued&per_page=1"]);
	daemon.queuedRuns(9);

	yield* daemon.dispatch("one");
	yield* daemon.dispatch("two");
	yield* daemon.status();

	expect(daemon.requests()).toEqual(["repos/example/project/actions/runs?status=queued&per_page=1"]);
	expect(daemon.launches()).toEqual(["fast", "fast"]);

	yield* daemon.intervalPasses();
	yield* daemon.dispatch("three");

	expect(daemon.requests()).toEqual([
		"repos/example/project/actions/runs?status=queued&per_page=1",
		"repos/example/project/actions/runs?status=queued&per_page=1",
	]);
	expect(daemon.launches()).toEqual(["fast", "fast", undefined]);
});

for (const queued of [0, 6]) {
	ciCapacity.it(`a failed queued-run read keeps the tier selected at ${queued} queued runs and still launches workers`, [], function* (daemon) {
		daemon.queuedRuns(queued);
		yield* daemon.intervalPasses();
		yield* daemon.dispatch("one");
		const tier = queued === 0 ? "fast" : undefined;
		expect(daemon.launches()).toEqual([tier]);

		daemon.failRead();
		yield* daemon.intervalPasses();
		yield* daemon.dispatch("two");

		yield* outcomes([
			["worker launches", () => Effect.sync(daemon.launches), [tier, tier]],
			["status", () => daemon.status(), { launchTier: { queuedRuns: queued, readFailed: true, serviceTier: tier } }],
			["CLI status", () => daemon.cliStatus(), { code: 0, stdout: expect.stringContaining("read failed, keeping last tier") }],
		]);
	});
}

ciCapacity.it("queued-run reads respect Fleet's GitHub reserve and keep launching on the last tier", [], function* (daemon) {
	daemon.reserveBudget();
	yield* daemon.intervalPasses();
	yield* daemon.dispatch("one");
	expect(daemon.launches()).toEqual([undefined]);
	const requests = daemon.requests();

	daemon.queuedRuns(0);
	yield* daemon.intervalPasses();
	yield* daemon.dispatch("two");

	yield* outcomes([
		["GitHub requests", () => Effect.sync(daemon.requests), requests],
		["worker launches", () => Effect.sync(daemon.launches), [undefined, undefined]],
		["status", () => daemon.status(), { launchTier: { queuedRuns: 5, readFailed: true, serviceTier: undefined } }],
	]);
});
