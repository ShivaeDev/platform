import { Effect } from "effect";
import { expect } from "vitest";
import { isolatedEngine } from "#test/engineStory.ts";
import { humanMergeRequired, noChangeReported } from "#test/engineTraits.ts";

isolatedEngine.it(
	"a renewed revision queues behind existing area waiters",
	[noChangeReported()],
	function* ({ fleet, prepareWork, finishWorkers, editWork, approveWork, setAreas }) {
		setAreas("one", ["fleet/host"]);
		setAreas("two", ["fleet/host"]);
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
		expect((yield* fleet.dispatch("two")).value.step).toBe("working");
	},
);
isolatedEngine.it(
	"overlapping areas serialize concurrent dispatch and completion admits the next task",
	[],
	function* ({ fleet, prepareWork, finishWorkers, setAreas, providerStarts }) {
		setAreas("one", ["fleet/host", "board/ui"]);
		setAreas("two", ["fleet/host"]);
		yield* prepareWork("one");
		yield* prepareWork("two");
		yield* Effect.all(
			[fleet.dispatch("one"), fleet.dispatch("two")].map((work) => work.pipe(Effect.result)),
			{ concurrency: "unbounded" },
		);
		expect(providerStarts()).toMatchObject([{ prompt: "Implement one" }]);
		yield* fleet.dispatch("two").pipe(Effect.result);
		expect((yield* fleet.get("two")).value).toMatchObject({
			attentionOwner: "automation",
			blocker: "waiting for area fleet/host held by one",
			step: "queued",
		});
		finishWorkers();
		expect((yield* fleet.reconcile("one")).value.step).toBe("done");
		const next = yield* fleet.dispatch("two");
		expect(next.value.step).toBe("working");
		expect(next.value.blocker).toBeUndefined();
	},
);
isolatedEngine.it("disjoint areas dispatch concurrently", [], function* ({ fleet, prepareWork, setAreas, launches }) {
	setAreas("one", ["fleet/host"]);
	setAreas("two", ["board/ui"]);
	yield* prepareWork("one");
	yield* prepareWork("two");
	const dispatched = yield* Effect.all([fleet.dispatch("one"), fleet.dispatch("two")], { concurrency: "unbounded" });
	expect(dispatched.map(({ value }) => value.step)).toEqual(["working", "working"]);
	expect(launches().sort()).toEqual(["operation-1", "operation-2"]);
});
isolatedEngine.it(
	"a safe human release frees the held area",
	[humanMergeRequired()],
	function* ({ fleet, prepareWork, finishWorkers, respond, setAreas }) {
		setAreas("one", ["fleet/host"]);
		setAreas("two", ["fleet/host"]);
		yield* prepareWork("one");
		yield* prepareWork("two");
		yield* fleet.dispatch("one");
		finishWorkers();
		const holder = yield* fleet.reconcile("one");
		yield* fleet.dispatch("two").pipe(Effect.result);
		expect((yield* fleet.get("two")).value.step).toBe("queued");
		const decision = holder.value.decision?.id ?? "missing";
		expect((yield* fleet.resolve("one", decision, respond(decision, "release"))).value.step).toBe("released");
		expect((yield* fleet.dispatch("two")).value.step).toBe("working");
	},
);
isolatedEngine.it(
	"restart preserves waiting order and racing dispatchers do not double launch",
	[],
	function* ({ fleet, prepareWork, finishWorkers, restart, schedule, setAreas, setDependencies, providerStarts }) {
		for (const id of ["one", "two", "dependent"]) {
			setAreas(id, ["fleet/host"]);
			setDependencies(id, []);
			yield* prepareWork(id);
		}
		yield* fleet.dispatch("one");
		yield* schedule();
		expect((yield* fleet.get("two")).value.blocker).toContain("held by one");
		expect((yield* fleet.get("dependent")).value.blocker).toContain("held by one");
		finishWorkers();
		yield* fleet.reconcile("one");
		yield* restart();
		yield* Effect.all(
			[fleet.dispatch("dependent"), fleet.dispatch("two"), fleet.dispatch("two")].map((work) => work.pipe(Effect.result)),
			{ concurrency: "unbounded" },
		);
		// Racing preparation writes can require the scheduler's next pass.
		yield* schedule();
		expect((yield* fleet.get("two")).value.step).toBe("working");
		expect((yield* fleet.get("dependent")).value.step).toBe("queued");
		expect((yield* fleet.get("two")).value.attempts).toMatchObject([{ prompt: "Implement two", role: "worker" }]);
		finishWorkers();
		yield* fleet.reconcile("two");
		yield* schedule();
		expect((yield* fleet.get("dependent")).value.step).toBe("working");
		expect(
			providerStarts()
				.filter((start) => start.access !== "read-only")
				.map((start) => start.prompt),
		).toEqual(["Implement one", "Implement two", "Implement dependent"]);
	},
);
