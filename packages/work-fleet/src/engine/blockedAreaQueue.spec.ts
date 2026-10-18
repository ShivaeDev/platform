import { expect } from "vitest";
import { fleetStory, highPrioritySecond, sharedArea } from "#test/fleetStory.ts";

for (const dispatch of ["direct", "scheduler"] as const) {
	fleetStory.it(
		`${dispatch} launches ready area work while an earlier item waits for an unmerged dependency`,
		[sharedArea, highPrioritySecond],
		function* (fleet) {
			fleet.dependencies("one", ["dependency"]);
			yield* fleet.prepare("dependency");
			yield* fleet.dispatch("dependency");
			yield* fleet.prepare("one");
			yield* fleet.prepare("two");
			if (dispatch === "scheduler") {
				yield* fleet.schedule();
			} else {
				yield* fleet.dispatch("two");
				yield* fleet.dispatch("one");
			}
			expect((yield* fleet.get("one")).value).toMatchObject({
				attempts: [],
				blocker: expect.stringContaining("waiting for dependency dependency"),
				stage: "prepared",
			});
			expect((yield* fleet.get("two")).value.stage).toBe("executing");
			expect((yield* fleet.get("dependency")).value.stage).toBe("executing");
		},
	);
}

fleetStory.it("a queued item that becomes dependency-blocked steps aside without reordering the other waiters", [sharedArea], function* (fleet) {
	for (const id of ["one", "two", "three"]) {
		yield* fleet.prepare(id);
	}
	yield* fleet.dispatch("three");
	expect((yield* fleet.get("three")).value.blocker).toBe("waiting for area shared queued ahead by one");
	fleet.dependencies("one", ["dependency"]);
	yield* fleet.dispatch("three");
	expect((yield* fleet.get("three")).value.blocker).toBe("waiting for area shared queued ahead by two");
	yield* fleet.dispatch("two");
	expect((yield* fleet.get("two")).value.stage).toBe("executing");
	fleet.finishWorkers();
	yield* fleet.reconcile("two");
	yield* fleet.schedule();
	expect((yield* fleet.get("one")).value).toMatchObject({
		attempts: [],
		blocker: expect.stringContaining("waiting for dependency dependency"),
		stage: "prepared",
	});
	expect((yield* fleet.get("three")).value.stage).toBe("executing");
});

fleetStory.it("an item joins the area queue once its dependency has an accepted merge", [sharedArea], function* (fleet) {
	fleet.dependencies("one", ["two"]);
	yield* fleet.prepare("one");
	yield* fleet.prepare("two");
	yield* fleet.dispatch("one");
	expect((yield* fleet.get("one")).value.blocker).toContain("waiting for dependency two");
	yield* fleet.dispatch("two");
	expect((yield* fleet.get("two")).value.stage).toBe("executing");
	fleet.finishWorkers();
	expect((yield* fleet.reconcile("two")).value.stage).toBe("completed");
	yield* fleet.prepare("three");
	yield* fleet.dispatch("three");
	expect((yield* fleet.get("three")).value.blocker).toBe("waiting for area shared queued ahead by one");
	yield* fleet.schedule();
	expect((yield* fleet.get("one")).value.stage).toBe("executing");
	expect((yield* fleet.get("one")).value.blocker).toBeUndefined();
});
