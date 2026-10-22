import { expect } from "vitest";
import { highPrioritySecond, sharedArea } from "#test/engineSchedulingTraits.ts";
import { isolatedEngine } from "#test/engineStory.ts";

for (const dispatch of ["direct", "scheduler"] as const) {
	isolatedEngine.it(
		`${dispatch} launches ready area work while an earlier item waits for an unmerged dependency`,
		[sharedArea, highPrioritySecond],
		function* (fleet) {
			fleet.setDependencies("one", ["dependency"]);
			yield* fleet.prepareWork("dependency");
			yield* fleet.dispatch("dependency");
			yield* fleet.prepareWork("one");
			yield* fleet.prepareWork("two");
			if (dispatch === "scheduler") {
				yield* fleet.schedule();
			} else {
				yield* fleet.dispatch("two");
				expect(yield* fleet.attemptDispatch("one")).toMatchObject({ _tag: "Forbidden" });
			}
			expect((yield* fleet.get("one")).value).toMatchObject({
				attempts: [],
				blocker: expect.stringContaining("waiting for dependency dependency"),
				step: "queued",
			});
			expect((yield* fleet.get("two")).value.step).toBe("working");
			expect((yield* fleet.get("dependency")).value.step).toBe("working");
		},
	);
}

isolatedEngine.it("a queued item that becomes dependency-blocked steps aside without reordering the other waiters", [sharedArea], function* (fleet) {
	for (const id of ["one", "two", "three"]) {
		yield* fleet.prepareWork(id);
	}
	expect(yield* fleet.attemptDispatch("three")).toMatchObject({ _tag: "StorageAdmission" });
	expect((yield* fleet.get("three")).value.blocker).toBe("waiting for area shared queued ahead by one");
	fleet.setDependencies("one", ["dependency"]);
	expect(yield* fleet.attemptDispatch("three")).toMatchObject({ _tag: "StorageAdmission" });
	expect((yield* fleet.get("three")).value.blocker).toBe("waiting for area shared queued ahead by two");
	yield* fleet.dispatch("two");
	expect((yield* fleet.get("two")).value.step).toBe("working");
	fleet.finishWorkers();
	yield* fleet.reconcile("two");
	yield* fleet.schedule();
	expect((yield* fleet.get("one")).value).toMatchObject({
		attempts: [],
		blocker: expect.stringContaining("waiting for dependency dependency"),
		step: "queued",
	});
	expect((yield* fleet.get("three")).value.step).toBe("working");
});

isolatedEngine.it("an item joins the area queue once its dependency has an accepted merge", [sharedArea], function* (fleet) {
	fleet.setDependencies("one", ["two"]);
	yield* fleet.prepareWork("one");
	yield* fleet.prepareWork("two");
	expect(yield* fleet.attemptDispatch("one")).toMatchObject({ _tag: "Forbidden" });
	expect((yield* fleet.get("one")).value.blocker).toContain("waiting for dependency two");
	yield* fleet.dispatch("two");
	expect((yield* fleet.get("two")).value.step).toBe("working");
	fleet.finishWorkers();
	expect((yield* fleet.reconcile("two")).value.step).toBe("done");
	yield* fleet.prepareWork("three");
	expect(yield* fleet.attemptDispatch("three")).toMatchObject({ _tag: "StorageAdmission" });
	expect((yield* fleet.get("three")).value.blocker).toBe("waiting for area shared queued ahead by one");
	yield* fleet.schedule();
	expect((yield* fleet.get("one")).value.step).toBe("working");
	expect((yield* fleet.get("one")).value.blocker).toBeUndefined();
});

isolatedEngine.it("an unreadable area waiter fails admission instead of letting later work pass", [sharedArea], function* (fleet) {
	yield* fleet.prepareWork("one");
	yield* fleet.prepareWork("two");
	fleet.unavailableWork("one", true);
	expect(yield* fleet.attemptDispatch("two")).toMatchObject({ _tag: "BoardFailure", message: "Board work unavailable" });
	expect((yield* fleet.get("two")).value).toMatchObject({ attempts: [], step: "queued" });
	fleet.unavailableWork("one", false);
	expect(yield* fleet.attemptDispatch("two")).toMatchObject({ _tag: "StorageAdmission", message: "waiting for area shared queued ahead by one" });
});

isolatedEngine.it("an unreadable later area waiter does not block the first item", [sharedArea], function* (fleet) {
	yield* fleet.prepareWork("one");
	yield* fleet.prepareWork("two");
	fleet.unavailableWork("two", true);
	expect((yield* fleet.dispatch("one")).value.step).toBe("working");
	expect((yield* fleet.get("two")).value).toMatchObject({ attempts: [], step: "queued" });
});

isolatedEngine.it("an unreadable earlier waiter cannot block the current area holder's continuation", [sharedArea], function* (fleet) {
	fleet.setDependencies("one", ["dependency"]);
	yield* fleet.prepareWork("one");
	yield* fleet.prepareWork("two");
	const first = yield* fleet.dispatch("two");
	yield* fleet.workerQuestion("two", "Which implementation should I use?");
	expect((yield* fleet.reconcile("two")).value.step).toBe("waiting");
	fleet.unavailableWork("one", true);
	const continued = yield* fleet.continueWork("two", "Use the existing implementation");
	expect(continued.value.step).toBe("working");
	expect(continued.value.attempts[0]).toMatchObject({
		prompt: "Use the existing implementation",
		receipt: { sessionId: first.value.attempts[0]?.receipt?.sessionId },
		role: "repair",
	});
	expect((yield* fleet.get("one")).value).toMatchObject({ attempts: [], step: "queued" });
});

isolatedEngine.it("continuing done work must resolve earlier waiters before reacquiring its area", [sharedArea], function* (fleet) {
	fleet.setDependencies("one", ["dependency"]);
	yield* fleet.prepareWork("one");
	yield* fleet.prepareWork("two");
	yield* fleet.dispatch("two");
	fleet.finishWorkers();
	expect((yield* fleet.reconcile("two")).value.step).toBe("done");
	fleet.unavailableWork("one", true);
	expect(yield* fleet.attemptContinue("two", "Follow up on the implementation")).toMatchObject({
		_tag: "BoardFailure",
		message: "Board work unavailable",
	});
	expect((yield* fleet.get("two")).value.step).toBe("done");
});
