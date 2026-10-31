import { expect } from "@effect/vitest";
import { availableQuota, backlogLimit, changedMainPaths, unknownProviderQuota } from "#test/engineLaunchTraits.ts";
import { engine, isolatedEngine } from "#test/engineStory.ts";
import { prepared } from "#test/preparation.ts";

engine.it("an unrelated main change refreshes the base revision and keeps the prior validation revision", [], function* (fleet) {
	yield* fleet.prepareWork("one");

	const launched = yield* fleet.dispatch("one");

	expect(launched.value.preparation).toMatchObject({ baseRevision: "current-main", validation: [{ revision: "prepared-main" }] });
});

engine.it("a main change to the prepared source stops admission before a provider launch", [changedMainPaths(["src/one.ts"])], function* (fleet) {
	yield* fleet.prepareWork("one");

	const dispatched = yield* fleet.dispatch("one");

	expect(dispatched.value.step).toBe("waiting");
	expect(fleet.launches()).toEqual([]);
});

engine.it("work with overlapping scope launches while other overlapping work runs beside a foreign PR", [], function* (fleet) {
	for (const workId of ["one", "two"]) {
		yield* fleet.prepare({ cwd: "/synthetic", preparation: prepared({ ownedPaths: ["."] }), prompt: `Implement ${workId}`, workId });
	}
	yield* fleet.reserveForeign("human-pr");
	expect((yield* fleet.dispatch("one")).value.step).toBe("working");

	const two = yield* fleet.dispatch("two");

	expect(two.value.step).toBe("working");
	expect(fleet.launches()).toEqual(["operation-1", "operation-2"]);
});

isolatedEngine.it("one unit of quota admits only one of two concurrent disjoint submissions", [availableQuota(1)], function* (fleet) {
	yield* fleet.prepareWork("one");
	yield* fleet.prepareWork("two");

	const dispatched = yield* fleet.dispatchTogether("one", "two");

	expect(dispatched.filter((outcome) => outcome === "working")).toEqual(["working"]);
	const [admitted] = (yield* fleet.list()).map(({ value }) => value).filter(({ step }) => step === "working");
	expect(admitted?.attempts).toMatchObject([{ role: "worker" }]);
	expect(fleet.launches()).toEqual(admitted?.attempts.map(({ operationId }) => operationId));
});

engine.it("unknown provider quota keeps the work queued with a quota blocker and no launch", [unknownProviderQuota()], function* (fleet) {
	yield* fleet.prepareWork("one");

	yield* fleet.attemptDispatch("one");

	expect(yield* fleet.workState("one")).toEqual({ attempts: 0, blocker: expect.stringContaining("quota"), step: "queued" });
	expect(fleet.launches()).toEqual([]);
});

engine.it("a submission behind an area waiter is refused and queued while the waiter still launches", [], function* (fleet) {
	fleet.setAreas("one", ["fleet/host"]);
	fleet.setAreas("two", ["fleet/host"]);
	yield* fleet.prepareWork("one");
	yield* fleet.prepareWork("two");

	const rejected = yield* fleet.attemptDispatch("two");

	expect(rejected).toBe("admission refused: waiting for area fleet/host queued ahead by one");
	expect(yield* fleet.workState("two")).toEqual({ attempts: 0, blocker: "waiting for area fleet/host queued ahead by one", step: "queued" });
	expect(fleet.launches()).toEqual([]);
	expect((yield* fleet.dispatch("one")).value.step).toBe("working");
});

engine.it("only the dependent waits for its dependency's accepted outcome while unrelated work launches", [], function* (fleet) {
	yield* fleet.prepareWork("dependent");
	yield* fleet.prepareWork("two");
	yield* fleet.prepareWork("one");
	expect(yield* fleet.attemptDispatch("dependent")).toMatch(/^forbidden: /u);
	yield* fleet.dispatch("two");
	expect(fleet.launches()).toEqual(["operation-1"]);
	yield* fleet.dispatch("one");
	fleet.finishWorkers();

	yield* fleet.reconcile("one");

	expect((yield* fleet.dispatch("dependent")).value.step).toBe("working");
});

engine.it("a working worker completes while a foreign PR backlog refuses new admission", [backlogLimit(1)], function* (fleet) {
	yield* fleet.prepareWork("one");
	yield* fleet.prepareWork("two");
	yield* fleet.dispatch("one");
	yield* fleet.reserveForeign("human-pr");
	fleet.finishWorkers();

	yield* fleet.attemptDispatch("two");

	expect(yield* fleet.blockerOf("two")).toContain("backlog");
	const completed = yield* fleet.reconcile("one");
	expect(completed.value.step).toBe("done");
});
