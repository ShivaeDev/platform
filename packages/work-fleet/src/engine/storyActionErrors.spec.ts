import { Cause, Effect, Exit } from "effect";
import { expect } from "vitest";
import { fleetStory, sharedArea } from "#test/fleetStory.ts";

fleetStory.it("an unexpectedly successful dispatch names the work in the story failure", [sharedArea], function* (fleet) {
	yield* fleet.prepare("one");
	const outcome = yield* fleet.attemptDispatch("one").pipe(Effect.exit);
	expect(Exit.isFailure(outcome)).toBe(true);
	if (Exit.isFailure(outcome)) {
		expect(Cause.pretty(outcome.cause)).toContain("Expected dispatching one to fail, but it succeeded");
	}
	expect((yield* fleet.get("one")).value.stage).toBe("executing");
});

fleetStory.it("an unexpectedly successful continuation names the work in the story failure", [sharedArea], function* (fleet) {
	yield* fleet.prepare("one");
	yield* fleet.dispatch("one");
	fleet.finishWorkers();
	expect((yield* fleet.reconcile("one")).value.stage).toBe("completed");
	const outcome = yield* fleet.attemptContinue("one", "Check the follow-up").pipe(Effect.exit);
	expect(Exit.isFailure(outcome)).toBe(true);
	if (Exit.isFailure(outcome)) {
		expect(Cause.pretty(outcome.cause)).toContain("Expected continuing one to fail, but it succeeded");
	}
	expect((yield* fleet.get("one")).value.stage).toBe("executing");
});
