import { expect } from "@effect/vitest";
import { approvedWork, host } from "#test/hostStory.ts";
import { preparationReadTrait } from "#test/preparationReadTrait.ts";

host.it(
	"an accepted dispatch joins the worker started by a scheduler pass while its preparation waits",
	[approvedWork(["one"]), preparationReadTrait()],
	function* (daemon) {
		const accepted = yield* daemon.request("daemon.dispatch", { workId: "one" });
		yield* daemon.awaitPreparationRead();
		yield* daemon.schedulerPass();
		const scheduled = yield* daemon.get("one");

		yield* daemon.releasePreparationRead();

		const settled = yield* daemon.dispatchOutcome("one");
		expect(settled).toMatchObject({ id: accepted.id, status: "completed" });
		expect(scheduled.step).toBe("working");
		expect(daemon.providerStarts().map(({ operationId }) => operationId)).toEqual(scheduled.attempts.map(({ operationId }) => operationId));
		expect((yield* daemon.get("one")).attempts).toEqual(scheduled.attempts);
	},
);
