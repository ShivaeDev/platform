import { expect } from "vitest";
import { task } from "#test/fleetHost.ts";
import { REPORT } from "#test/githubResult.ts";
import { boardWork, host, storedWork } from "#test/hostStory.ts";
import { humanDelivery } from "#test/humanDelivery.ts";

const one = task("one", "approved");
const dependent = task("dependent", "approved").replace("kind: task", "kind: task\nrelationships: [{ kind: depends_on, target: one }]");

host.it(
	"a released approved task returns on admission and its human merge unblocks its dependent",
	[boardWork({ "dependent.md": dependent, "one.md": one }), humanDelivery],
	function* (daemon) {
		yield* daemon.schedulerPass();
		const first = yield* daemon.get("one");
		daemon.finishTurn(first, "FLEET_QUESTION: Which implementation should I use?");
		expect((yield* daemon.reconcile("one")).stage).toBe("needs-human");
		yield* daemon.answer("one", undefined, true);
		expect((yield* daemon.get("one")).stage).toBe("released");
		yield* daemon.stop();
		yield* daemon.start();
		expect(yield* daemon.admit()).toEqual([]);
		expect((yield* daemon.get("one")).stage).toBe("prepared");
		yield* daemon.schedule();
		const resumed = yield* daemon.get("one");
		expect(resumed.stage).toBe("executing");
		expect(resumed.history?.[0]?.stage).toBe("released");
		expect(resumed.attempts[0]?.receipt?.sessionId).not.toBe(first.attempts[0]?.receipt?.sessionId);
		expect((yield* daemon.get("dependent")).blocker).toContain("waiting for dependency one");
		daemon.finishTurn(resumed, REPORT);
		expect((yield* daemon.reconcile("one")).decision?.code).toBe("reviewed-pr-ready");
		daemon.mergePullRequest();
		expect((yield* daemon.reconcile("one")).stage).toBe("completed");
		yield* daemon.schedulerPass();
		expect((yield* daemon.get("dependent")).stage).toBe("executing");
	},
);

host.it(
	"holding a re-admitted task keeps it released after a worker question",
	[boardWork({ "one.md": one }), storedWork("one", "released")],
	function* (daemon) {
		yield* daemon.schedulerPass();
		const launched = yield* daemon.get("one");
		expect(launched.stage).toBe("executing");
		daemon.finishTurn(launched, "FLEET_QUESTION: Which implementation should I use?");
		expect((yield* daemon.reconcile("one")).stage).toBe("needs-human");
		daemon.writeBoard("one.md", one.replace("fleet: approved", "fleet: held"));
		yield* daemon.answer("one", undefined, true);
		const released = yield* daemon.storedRecord("one");
		expect(released.value.stage).toBe("released");
		const starts = daemon.providerStarts();
		yield* daemon.schedulerPass();
		expect((yield* daemon.get("one")).stage).toBe("released");
		expect(daemon.providerStarts()).toEqual(starts);
	},
);

for (const field of ["fleet: none", "status: dropped", "status: done", "status: superseded", "status: deferred"]) {
	const source = field.startsWith("fleet:") ? one.replace("fleet: approved", field) : one.replace("kind: task", `kind: task\n${field}`);
	host.it(
		`a released task with ${field} stays released on admission`,
		[boardWork({ "one.md": source }), storedWork("one", "released")],
		function* (daemon) {
			const released = yield* daemon.storedRecord("one");
			yield* daemon.schedulerPass();
			expect(yield* daemon.storedRecord("one")).toEqual(released);
			expect(daemon.providerStarts()).toEqual([]);
		},
	);
}

host.it("a dropped task is never admitted", [boardWork({ "one.md": one.replace("kind: task", "kind: task\nstatus: dropped") })], function* (daemon) {
	yield* daemon.schedulerPass();
	expect(yield* daemon.loadStoredRecord("one")).toBeUndefined();
	expect(daemon.providerStarts()).toEqual([]);
});

host.it(
	"a released task with a recorded human merge stays released even while approved",
	[boardWork({ "one.md": one }), storedWork("one", "released", { mergedDelivery: { head: "merged-head", url: "https://example.invalid/pr/one" } })],
	function* (daemon) {
		const released = yield* daemon.storedRecord("one");
		yield* daemon.schedulerPass();
		expect(yield* daemon.storedRecord("one")).toEqual(released);
		expect(daemon.providerStarts()).toEqual([]);
	},
);
