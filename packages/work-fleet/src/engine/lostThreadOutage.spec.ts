import { expect } from "@effect/vitest";
import { unreadablePublication } from "#test/engineLostTurnTraits.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { lostThreadAcknowledgement } from "#test/lostThreadAcknowledgement.ts";

isolatedEngine.it(
	"fresh-thread restarts keep retrying while the provider remains unavailable",
	[lostThreadAcknowledgement(1, 1)],
	function* ({ prepareWork, dispatch, get, restart, advanceTime, schedule, launches, publishedDecisions }) {
		yield* prepareWork("one");
		yield* dispatch("one");
		for (const delay of [30_000, 60_000, 120_000, 240_000, 30_000]) {
			advanceTime(delay);
			yield* restart();
			yield* schedule();
		}
		const retrying = (yield* get("one")).value;
		expect(retrying.decision).toBeUndefined();
		expect(retrying.attempts.at(-1)?.abandoned?.observationError).toContain("still unavailable");
		expect(retrying.launchRetry).toMatchObject({ rejections: 2 });
		advanceTime(60_000);
		yield* restart();
		yield* schedule();
		const recovered = (yield* get("one")).value;
		expect(recovered.step).toBe("working");
		expect(recovered.attempts.at(-1)?.receipt?.sessionId).toBe("session-operation-3");
		expect(launches()).toEqual(["operation-1", "operation-2", "operation-3"]);
		expect(publishedDecisions()).toEqual([]);
	},
);

isolatedEngine.it(
	"a lost thread waits for the orchestrator when published work cannot be determined",
	[lostThreadAcknowledgement(), unreadablePublication("branch")],
	function* ({ prepareWork, dispatch, get, restart, advanceTime, schedule, launches }) {
		yield* prepareWork("one");
		yield* dispatch("one");
		for (const delay of [30_000, 60_000, 120_000, 240_000]) {
			advanceTime(delay);
			yield* restart();
			yield* schedule();
		}
		const waiting = (yield* get("one")).value;
		expect(waiting.step).toBe("waiting");
		expect(waiting.decision?.reason).toContain("cannot determine published work");
		expect(waiting.attempts.at(-1)?.status).toBe("submitting");
		expect(launches()).toEqual(["operation-1"]);
	},
);

isolatedEngine.it(
	"recorded worker output prevents an automatic lost-thread restart",
	[lostThreadAcknowledgement()],
	function* ({ prepareWork, dispatch, get, replaceStoredRecord, restart, advanceTime, schedule, launches }) {
		yield* prepareWork("one");
		const submitted = (yield* dispatch("one")).value;
		yield* replaceStoredRecord({ ...submitted, attempts: submitted.attempts.map((attempt) => ({ ...attempt, output: "Worker reported progress" })) });
		for (const delay of [30_000, 60_000, 120_000, 240_000]) {
			advanceTime(delay);
			yield* restart();
			yield* schedule();
		}
		const waiting = (yield* get("one")).value;
		expect(waiting.step).toBe("waiting");
		expect(waiting.decision?.reason).toContain("recorded worker output prevents automatic fresh-thread restart");
		expect(launches()).toEqual(["operation-1"]);
	},
);
