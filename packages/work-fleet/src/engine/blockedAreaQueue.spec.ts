import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { highPrioritySecond, sharedArea } from "#test/engineSchedulingTraits.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { noChangeReported } from "#test/engineTraits.ts";

const waitingForDependency = expect.stringContaining("waiting for dependency dependency");

isolatedEngine.it(
	"direct dispatch launches ready area work while an earlier item waits for an unmerged dependency",
	[sharedArea, highPrioritySecond],
	function* (fleet) {
		fleet.setDependencies("one", ["dependency"]);
		yield* fleet.prepareWork("dependency");
		yield* fleet.dispatch("dependency");
		yield* fleet.prepareWork("one");
		yield* fleet.prepareWork("two");

		yield* fleet.dispatch("two");

		yield* outcomes([
			["dispatching one", () => fleet.attemptDispatch("one"), expect.stringMatching(/^forbidden: /u)],
			["one", () => fleet.blockerOf("one"), waitingForDependency],
			["attempts on one", () => fleet.attemptsOf("one"), 0],
			["stages", () => fleet.workStages(["dependency", "one", "two"]), { dependency: "working", one: "queued", two: "working" }],
		]);
	},
);

isolatedEngine.it(
	"the scheduler launches ready area work while an earlier item waits for an unmerged dependency",
	[sharedArea, highPrioritySecond],
	function* (fleet) {
		fleet.setDependencies("one", ["dependency"]);
		yield* fleet.prepareWork("dependency");
		yield* fleet.dispatch("dependency");
		yield* fleet.prepareWork("one");
		yield* fleet.prepareWork("two");

		yield* fleet.schedule();

		yield* outcomes([
			["one", () => fleet.blockerOf("one"), waitingForDependency],
			["attempts on one", () => fleet.attemptsOf("one"), 0],
			["stages", () => fleet.workStages(["dependency", "one", "two"]), { dependency: "working", one: "queued", two: "working" }],
		]);
	},
);

isolatedEngine.it(
	"a queued item that becomes dependency-blocked steps aside so the next waiter runs without reordering the rest",
	[sharedArea],
	function* (fleet) {
		for (const id of ["one", "two", "three"]) {
			yield* fleet.prepareWork(id);
		}
		expect(yield* fleet.attemptDispatch("three")).toBe("admission refused: waiting for area shared queued ahead by one");

		fleet.setDependencies("one", ["dependency"]);

		expect(yield* fleet.attemptDispatch("three")).toBe("admission refused: waiting for area shared queued ahead by two");
		yield* fleet.dispatch("two");
		fleet.finishWorkers();
		yield* fleet.reconcile("two");
		yield* fleet.schedule();
		yield* outcomes([
			["one", () => fleet.blockerOf("one"), waitingForDependency],
			["attempts on one", () => fleet.attemptsOf("one"), 0],
			["stages", () => fleet.workStages(["one", "three"]), { one: "queued", three: "working" }],
		]);
	},
);

isolatedEngine.it("an item joins the area queue ahead of later work once its dependency merges", [sharedArea], function* (fleet) {
	fleet.setDependencies("one", ["two"]);
	yield* fleet.prepareWork("one");
	yield* fleet.prepareWork("two");
	expect(yield* fleet.attemptDispatch("one")).toMatch(/^forbidden: .*waiting for dependency two/u);
	yield* fleet.dispatch("two");
	fleet.finishWorkers();

	expect((yield* fleet.reconcile("two")).value.step).toBe("done");

	yield* fleet.prepareWork("three");
	expect(yield* fleet.attemptDispatch("three")).toBe("admission refused: waiting for area shared queued ahead by one");
	yield* fleet.schedule();
	yield* outcomes([
		["one", () => fleet.stepOf("one"), "working"],
		["blocker on one", () => fleet.blockerOf("one"), "no blocker"],
	]);
});

isolatedEngine.it("an unreadable area waiter refuses later admission until the Board reads it again", [sharedArea], function* (fleet) {
	yield* fleet.prepareWork("one");
	yield* fleet.prepareWork("two");
	fleet.unavailableWork("one", true);

	expect(yield* fleet.attemptDispatch("two")).toBe("Board failure: Board work unavailable");

	yield* outcomes([
		["two", () => fleet.stepOf("two"), "queued"],
		["attempts on two", () => fleet.attemptsOf("two"), 0],
	]);
	fleet.unavailableWork("one", false);
	expect(yield* fleet.attemptDispatch("two")).toBe("admission refused: waiting for area shared queued ahead by one");
});

isolatedEngine.it("an unreadable later area waiter does not block the first item", [sharedArea], function* (fleet) {
	yield* fleet.prepareWork("one");
	yield* fleet.prepareWork("two");
	fleet.unavailableWork("two", true);

	const dispatched = yield* fleet.dispatch("one");

	expect(dispatched.value.step).toBe("working");
	yield* outcomes([
		["two", () => fleet.stepOf("two"), "queued"],
		["attempts on two", () => fleet.attemptsOf("two"), 0],
	]);
});

isolatedEngine.it("an unreadable earlier waiter cannot block the area holder's continuation in its own session", [sharedArea], function* (fleet) {
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
	expect(yield* fleet.stepOf("one")).toBe("queued");
});

isolatedEngine.it(
	"continuing done work behind an unreadable earlier waiter is refused and leaves the work done",
	[sharedArea, noChangeReported()],
	function* (fleet) {
		fleet.setDependencies("one", ["dependency"]);
		yield* fleet.prepareWork("one");
		yield* fleet.prepareWork("two");
		yield* fleet.dispatch("two");
		fleet.finishWorkers();
		expect((yield* fleet.reconcile("two")).value.step).toBe("done");
		fleet.unavailableWork("one", true);

		const outcome = yield* fleet.attemptContinue("two", "Follow up on the implementation");

		expect(outcome).toBe("Board failure: Board work unavailable");
		expect(yield* fleet.stepOf("two")).toBe("done");
	},
);
