import { Clock } from "effect";
import { TestClock } from "effect/testing";
import { expect } from "vitest";
import { engine } from "#test/engineStory.ts";

engine.it(
	"records each turn's acknowledgement and first terminal observation",
	[],
	function* ({ prepareWork, dispatch, reconcile, get, finishWorkers }) {
		yield* prepareWork("one");
		const started = yield* Clock.currentTimeMillis;
		const worker = (yield* dispatch("one")).value.attempts[0];
		expect(worker?.startedAt).toBe(started);
		expect(worker?.finishedAt).toBeUndefined();
		yield* TestClock.adjust("2 minutes");
		finishWorkers();
		yield* reconcile("one");
		const finished = (yield* get("one")).value.attempts[0];
		expect(finished?.startedAt).toBe(started);
		expect(finished?.finishedAt).toBe(started + 120_000);
		yield* TestClock.adjust("1 minute");
		yield* reconcile("one");
		expect((yield* get("one")).value.attempts[0]?.finishedAt).toBe(started + 120_000);
	},
);
