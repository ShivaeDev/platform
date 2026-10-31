import { Clock } from "effect";
import { expect } from "vitest";
import { engine } from "#test/engineStory.ts";

const TWO_MINUTES = 120_000;

engine.it("a dispatched worker turn records its acknowledgement time and no finish yet", [], function* ({ prepareWork, dispatch }) {
	yield* prepareWork("one");
	const started = yield* Clock.currentTimeMillis;

	const worker = (yield* dispatch("one")).value.attempts[0];

	expect({ finishedAt: worker?.finishedAt, startedAt: worker?.startedAt }).toEqual({ finishedAt: undefined, startedAt: started });
});

engine.it(
	"a finished worker turn records its first terminal observation and keeps it on later reconciliation",
	[],
	function* ({ prepareWork, dispatch, reconcile, get, finishWorkers, elapse }) {
		yield* prepareWork("one");
		const started = yield* Clock.currentTimeMillis;
		yield* dispatch("one");
		yield* elapse("2 minutes");
		finishWorkers();
		yield* reconcile("one");
		expect((yield* get("one")).value.attempts[0]?.finishedAt).toBe(started + TWO_MINUTES);

		yield* elapse("1 minute");
		yield* reconcile("one");

		expect((yield* get("one")).value.attempts[0]).toMatchObject({ finishedAt: started + TWO_MINUTES, startedAt: started });
	},
);
