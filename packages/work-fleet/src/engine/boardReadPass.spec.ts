import { Fiber } from "effect";
import { expect } from "vitest";
import { isolatedEngine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";
import { schedulerProvider } from "#test/schedulerProvider.ts";

isolatedEngine.it(
	"a reconciliation awaiting its provider sees a Board edit after the scheduler pass ends",
	[markdownWork(), schedulerProvider],
	function* (fleet) {
		yield* fleet.prepareWork("one");
		const dispatched = yield* fleet.dispatch("one");
		const provider = fleet.holdSchedulerObservation(dispatched.value.attempts[0]?.receipt);
		const schedule = yield* fleet.startBoardReadScheduler("one");
		yield* provider.entered;
		yield* schedule.sleeping;
		fleet.writeBoardWork("one.md", "---\nid: one\nkind: task\nfleet: held\n---\n# one\n\nEdited during scheduler sleep.\n");
		yield* provider.release;
		yield* fleet.awaitRecordedStage("one", "waiting");
		const reconciled = (yield* fleet.get("one")).value;
		expect(reconciled.decision).toMatchObject({
			code: "fleet-stale",
			publicationWork: { approved: false, context: expect.stringContaining("Edited during scheduler sleep.") },
		});
		yield* Fiber.interrupt(schedule.runner);
	},
);
