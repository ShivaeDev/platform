import { Effect } from "effect";
import { expect } from "vitest";
import { Fleet } from "#fleet.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { humanMergeRequired, noChangeReported } from "#test/engineTraits.ts";

isolatedEngine.it(
	"a renewed revision queues behind existing area waiters",
	[noChangeReported()],
	function* ({ fixture, fleet, prepareWork, finishWorkers, editWork, approveWork }) {
		fixture.areas("one", ["fleet/host"]);
		fixture.areas("two", ["fleet/host"]);
		yield* prepareWork("one");
		yield* prepareWork("two");
		yield* fleet.dispatch("one");
		finishWorkers();
		yield* fleet.reconcile("one");
		editWork("one", "renewed-revision");
		approveWork("one", "renewed-revision");
		yield* prepareWork("one");
		yield* fleet.dispatch("one").pipe(Effect.result);
		expect((yield* fleet.get("one")).value.blocker).toContain("queued ahead by two");
		expect((yield* fleet.dispatch("two")).value.stage).toBe("executing");
	},
);

isolatedEngine.it(
	"overlapping areas serialize concurrent dispatch and completion admits the next task",
	[],
	function* ({ fixture, fleet, prepareWork, finishWorkers }) {
		fixture.areas("one", ["fleet/host", "board/ui"]);
		fixture.areas("two", ["fleet/host"]);
		yield* prepareWork("one");
		yield* prepareWork("two");
		yield* Effect.all(
			[fleet.dispatch("one"), fleet.dispatch("two")].map((work) => work.pipe(Effect.result)),
			{ concurrency: "unbounded" },
		);
		expect(fixture.launched).toHaveLength(1);
		yield* fleet.dispatch("two").pipe(Effect.result);
		expect((yield* fleet.get("two")).value).toMatchObject({
			attentionOwner: "automation",
			blocker: "waiting for area fleet/host held by one",
			stage: "prepared",
		});
		finishWorkers();
		expect((yield* fleet.reconcile("one")).value.stage).toBe("completed");
		const next = yield* fleet.dispatch("two");
		expect(next.value.stage).toBe("executing");
		expect(next.value.blocker).toBeUndefined();
	},
);

isolatedEngine.it("disjoint areas dispatch concurrently", [], function* ({ fixture, fleet, prepareWork }) {
	fixture.areas("one", ["fleet/host"]);
	fixture.areas("two", ["board/ui"]);
	yield* prepareWork("one");
	yield* prepareWork("two");
	const dispatched = yield* Effect.all([fleet.dispatch("one"), fleet.dispatch("two")], { concurrency: "unbounded" });
	expect(dispatched.map(({ value }) => value.stage)).toEqual(["executing", "executing"]);
	expect(fixture.launched).toHaveLength(2);
});

isolatedEngine.it(
	"a safe human release frees the held area",
	[humanMergeRequired()],
	function* ({ fixture, fleet, prepareWork, finishWorkers, respond }) {
		fixture.areas("one", ["fleet/host"]);
		fixture.areas("two", ["fleet/host"]);
		yield* prepareWork("one");
		yield* prepareWork("two");
		yield* fleet.dispatch("one");
		finishWorkers();
		const holder = yield* fleet.reconcile("one");
		yield* fleet.dispatch("two").pipe(Effect.result);
		expect((yield* fleet.get("two")).value.stage).toBe("prepared");
		const decision = holder.value.decision?.id ?? "missing";
		expect((yield* fleet.resolve("one", decision, respond(decision, "release"))).value.stage).toBe("released");
		expect((yield* fleet.dispatch("two")).value.stage).toBe("executing");
	},
);

isolatedEngine.it(
	"restart preserves waiting order and racing dispatchers do not double launch",
	[],
	function* ({ fixture, fleet, prepareWork, finishWorkers, restart, schedule }) {
		for (const id of ["one", "two", "dependent"]) {
			fixture.areas(id, ["fleet/host"]);
			fixture.dependencies(id, []);
			yield* prepareWork(id);
		}
		yield* fleet.dispatch("one");
		yield* schedule();
		expect((yield* fleet.get("two")).value.blocker).toContain("held by one");
		expect((yield* fleet.get("dependent")).value.blocker).toContain("held by one");
		finishWorkers();
		yield* fleet.reconcile("one");
		yield* restart(
			Effect.gen(function* () {
				const restarted = yield* Fleet;
				yield* Effect.all(
					[restarted.dispatch("dependent"), restarted.dispatch("two"), restarted.dispatch("two")].map((work) => work.pipe(Effect.result)),
					{ concurrency: "unbounded" },
				);
				// Racing preparation writes can require the scheduler's next pass.
				yield* schedule();
				expect((yield* restarted.get("two")).value.stage).toBe("executing");
				expect((yield* restarted.get("dependent")).value.stage).toBe("prepared");
				expect((yield* restarted.get("two")).value.attempts).toHaveLength(1);
				finishWorkers();
				yield* restarted.reconcile("two");
				yield* schedule();
				expect((yield* restarted.get("dependent")).value.stage).toBe("executing");
			}),
		);
		expect(fixture.starts.filter((start) => start.access !== "read-only").map((start) => start.prompt)).toEqual([
			"Implement one",
			"Implement two",
			"Implement dependent",
		]);
	},
);
