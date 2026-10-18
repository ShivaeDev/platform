import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { availableQuota, backlogLimit, changedMainPaths, unknownProviderQuota } from "#test/engineLaunchTraits.ts";
import { engine, isolatedEngine } from "#test/engineStory.ts";
import { prepared } from "#test/preparation.ts";

describe("Fleet admission path", () => {
	engine.it("refreshes an unrelated main change while preserving prior validation revision", [], function* (fleet) {
		yield* fleet.prepareWork("one");
		const launched = yield* fleet.dispatch("one");
		expect(launched.value.preparation.baseRevision).toBe("current-main");
		expect(launched.value.preparation.validation[0]?.revision).toBe("prepared-main");
	});
	engine.it("a main change to the prepared source blocks admission before provider launch", [changedMainPaths(["src/one.ts"])], function* (fleet) {
		yield* fleet.prepareWork("one");
		expect((yield* fleet.dispatch("one")).value.stage).toBe("needs-human");
		expect(fleet.launches()).toHaveLength(0);
	});
	engine.it("work with overlapping scope and foreign PRs dispatches concurrently", [], function* (fleet) {
		for (const workId of ["one", "two"]) {
			yield* fleet.prepare({ cwd: "/synthetic", preparation: prepared({ ownedPaths: ["."] }), prompt: `Implement ${workId}`, workId });
		}
		yield* fleet.reserveForeign("human-pr");
		expect((yield* fleet.dispatch("one")).value.stage).toBe("executing");
		expect((yield* fleet.dispatch("two")).value.stage).toBe("executing");
		expect(fleet.launches()).toHaveLength(2);
	});
	isolatedEngine.it("one unit of quota cannot admit two concurrent disjoint submissions", [availableQuota(1)], function* (fleet) {
		yield* fleet.prepareWork("one");
		yield* fleet.prepareWork("two");
		const outcomes = yield* Effect.all([fleet.dispatch("one").pipe(Effect.result), fleet.dispatch("two").pipe(Effect.result)], {
			concurrency: "unbounded",
		});
		expect(outcomes.map((outcome) => outcome._tag).sort()).toEqual(["Failure", "Success"]);
		expect(fleet.launches()).toHaveLength(1);
	});
	engine.it("unknown quota remains prepared with a concrete blocker", [unknownProviderQuota()], function* (fleet) {
		yield* fleet.prepareWork("one");
		yield* fleet.dispatch("one").pipe(Effect.result);
		const waiting = (yield* fleet.get("one")).value;
		expect(waiting).toMatchObject({ attempts: [], blocker: expect.stringContaining("quota"), stage: "prepared" });
		expect(fleet.launches()).toHaveLength(0);
	});
	engine.it("the production repository rejects a submission behind an area waiter", [], function* (fleet) {
		fleet.setAreas("one", ["fleet/host"]);
		fleet.setAreas("two", ["fleet/host"]);
		yield* fleet.prepareWork("one");
		yield* fleet.prepareWork("two");
		const rejected = yield* Effect.flip(fleet.dispatch("two"));
		expect(rejected).toMatchObject({ message: "waiting for area fleet/host queued ahead by one" });
		expect((yield* fleet.get("two")).value).toMatchObject({
			attempts: [],
			blocker: "waiting for area fleet/host queued ahead by one",
			stage: "prepared",
		});
		expect(fleet.launches()).toHaveLength(0);
		expect((yield* fleet.dispatch("one")).value.stage).toBe("executing");
	});
	engine.it("only dependents wait for accepted outcomes", [], function* (fleet) {
		yield* fleet.prepareWork("dependent");
		yield* fleet.prepareWork("two");
		yield* fleet.prepareWork("one");
		yield* fleet.dispatch("dependent").pipe(Effect.result);
		yield* fleet.dispatch("two");
		expect(fleet.launches()).toHaveLength(1);
		yield* fleet.dispatch("one");
		fleet.finishWorkers();
		yield* fleet.reconcile("one");
		expect((yield* fleet.dispatch("dependent")).value.stage).toBe("executing");
	});
	engine.it("an executing worker completes while a foreign PR backlog blocks new admission", [backlogLimit(1)], function* (fleet) {
		yield* fleet.prepareWork("one");
		yield* fleet.prepareWork("two");
		yield* fleet.dispatch("one");
		yield* fleet.reserveForeign("human-pr");
		fleet.finishWorkers();
		yield* fleet.dispatch("two").pipe(Effect.result);
		expect((yield* fleet.get("two")).value.blocker).toContain("backlog");
		expect((yield* fleet.reconcile("one")).value.stage).toBe("completed");
	});
});
