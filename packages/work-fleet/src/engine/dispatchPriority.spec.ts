import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { views } from "#engine/views.ts";
import { renderStatus } from "#host/renderStatus.ts";
import { priorityTask } from "#test/engineBriefFixtures.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { markdownWork, oneExecutionSlot } from "#test/engineTraits.ts";

describe("Fleet dispatch priority", () => {
	isolatedEngine.it(
		"dispatch now launches at full concurrency while a normal dispatch waits",
		[oneExecutionSlot],
		function* ({ workStages, approveWork, prepareWork, fleet, schedule }) {
			approveWork("three", "board-three");
			for (const id of ["one", "two", "three"]) {
				yield* prepareWork(id);
			}
			yield* fleet.dispatch("one");
			yield* fleet.dispatch("two").pipe(Effect.result);
			const urgent = yield* fleet.dispatch("three", undefined, { ignoreAreas: false });
			expect(urgent.value.attempts.at(-1)).toMatchObject({ overLimit: true, role: "worker" });
			yield* schedule();
			expect(yield* workStages(["one", "two", "three"])).toEqual({ one: "working", three: "working", two: "queued" });
			expect((yield* fleet.get("two")).value.blocker).toBe("execution capacity is occupied (limit 1)");
			const status = renderStatus(views((yield* fleet.list()).map(({ value }) => value)));
			expect(status).toContain("three  working  launched over the limit");
			expect(status).not.toContain("one  working  launched over the limit");
		},
	);

	isolatedEngine.it(
		"urgent work still waits for a held area unless dispatch ignores areas",
		[oneExecutionSlot],
		function* ({ setAreas, setPriority, workStages, approveWork, prepareWork, fleet, schedule }) {
			approveWork("three", "board-three");
			setAreas("one", ["work-fleet/scheduler"]);
			setAreas("two", ["work-fleet/scheduler"]);
			setAreas("three", ["work-board/ui"]);
			setPriority("two", "urgent");
			setPriority("three", "urgent");
			for (const id of ["one", "two", "three"]) {
				yield* prepareWork(id);
			}
			yield* fleet.dispatch("one");
			yield* schedule();
			expect(yield* workStages(["one", "two", "three"])).toEqual({ one: "working", three: "working", two: "queued" });
			expect((yield* fleet.get("two")).value.blocker).toBe("waiting for area work-fleet/scheduler held by one");
			const forced = yield* fleet.dispatch("two", undefined, { ignoreAreas: true });
			expect(forced.value.attempts.at(-1)).toMatchObject({ overLimit: true, role: "worker" });
		},
	);

	isolatedEngine.it(
		"a dispatch now request waiting for an area launches over the limit once the area frees",
		[oneExecutionSlot],
		function* ({ setAreas, workStages, approveWork, finishWorkers, prepareWork, fleet }) {
			approveWork("three", "board-three");
			setAreas("one", ["work-fleet/scheduler"]);
			setAreas("two", ["work-fleet/scheduler"]);
			for (const id of ["one", "two", "three"]) {
				yield* prepareWork(id);
			}
			yield* fleet.dispatch("one");
			yield* fleet.dispatch("two", undefined, { ignoreAreas: false }).pipe(Effect.result);
			expect((yield* fleet.get("two")).value).toMatchObject({
				blocker: "waiting for area work-fleet/scheduler held by one",
				dispatchNow: { ignoreAreas: false },
				step: "queued",
			});
			finishWorkers();
			expect((yield* fleet.reconcile("one")).value.step).toBe("done");
			yield* fleet.dispatch("three");
			const launched = yield* fleet.dispatch("two");
			expect(launched.value.attempts.at(-1)).toMatchObject({ overLimit: true, role: "worker" });
			expect(yield* workStages(["two", "three"])).toEqual({ three: "working", two: "working" });
		},
	);

	isolatedEngine.it("dispatch now still waits for an unfinished dependency", [oneExecutionSlot], function* ({ finishWorkers, prepareWork, fleet }) {
		yield* prepareWork("dependent");
		yield* prepareWork("one");
		yield* fleet.dispatch("dependent", undefined, { ignoreAreas: true }).pipe(Effect.result);
		expect((yield* fleet.get("dependent")).value).toMatchObject({ attempts: [], dispatchNow: { ignoreAreas: true }, step: "queued" });
		yield* fleet.dispatch("one");
		finishWorkers();
		expect((yield* fleet.reconcile("one")).value.step).toBe("done");
		expect((yield* fleet.dispatch("dependent")).value.step).toBe("working");
	});

	isolatedEngine.it(
		"high priority work is admitted before normal work when slots are short",
		[oneExecutionSlot],
		function* ({ setPriority, workStages, approveWork, prepareWork, schedule }) {
			for (const id of ["three", "four"]) {
				approveWork(id, `board-${id}`);
			}
			setPriority("three", "high");
			setPriority("four", "high");
			for (const id of ["one", "two", "three", "four"]) {
				yield* prepareWork(id);
			}
			yield* schedule();
			expect(yield* workStages(["one", "two", "three", "four"])).toEqual({ four: "queued", one: "queued", three: "working", two: "queued" });
		},
	);

	isolatedEngine.it(
		"Board frontmatter priority orders admission and rejects unknown values",
		[markdownWork(), oneExecutionSlot],
		function* ({ writeBoardWork, workStages, prepareWork, schedule }) {
			writeBoardWork("two.md", priorityTask("two", "normal"));
			writeBoardWork("three.md", priorityTask("three", "high"));
			writeBoardWork("four.md", priorityTask("four", "soon"));
			for (const id of ["one", "two", "three"]) {
				yield* prepareWork(id);
			}
			const invalid = yield* prepareWork("four").pipe(Effect.flip);
			expect(invalid.message).toContain("Invalid fleet-priority; use urgent, high, normal or low, or omit the field.");
			yield* schedule();
			expect(yield* workStages(["one", "two", "three"])).toEqual({ one: "queued", three: "working", two: "queued" });
		},
	);
});
