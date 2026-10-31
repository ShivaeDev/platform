import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { WireRejection } from "#test/codex.ts";
import { localRequestTimeout, timedProviderStory } from "#test/providerStory.ts";
import { inTurn, later, page } from "#test/wireScript.ts";

const CONTINUE = { operationId: "operation", prompt: "Continue", sessionId: "thread" };
const BUSY = new WireRejection("turn already active for thread");
const REJECTED = "Codex rejected the protocol request: turn already active for thread";
const SUBMISSION = { clientUserMessageId: "operation", input: [{ text: "Continue", "text_elements": [], type: "text" }], threadId: "thread" };

timedProviderStory.it(
	"an idle thread that keeps rejecting as busy gets the same turn after 5, 10 and 20 second backoffs and then fails",
	[localRequestTimeout(600_000)],
	function* ({ answers, delayElapses, provider, sent }) {
		yield* answers({ "thread/turns/list": page([]), "turn/start": BUSY });
		const submission = yield* provider.submitInBackground(CONTINUE);

		yield* delayElapses(5000);
		yield* delayElapses(10_000);
		yield* delayElapses(20_000);

		yield* outcomes([
			[
				"submission",
				() => submission.outcome(),
				`session rejected (session-active-turn-exhausted): ${REJECTED}; active-turn resubmission limit reached`,
			],
			["submitted turns", () => sent("turn/start"), [SUBMISSION, SUBMISSION, SUBMISSION, SUBMISSION]],
		]);
	},
);

timedProviderStory.it(
	"a busy rejection whose idle check outlasts the five-minute deadline fails without resubmission",
	[localRequestTimeout(600_000)],
	function* ({ answers, delayElapses, provider, sent }) {
		yield* answers({ "thread/turns/list": later(299_000, page([])), "turn/start": BUSY });
		const submission = yield* provider.submitInBackground(CONTINUE);

		yield* delayElapses(299_000);
		yield* delayElapses(1000);

		yield* outcomes([
			["submission", () => submission.outcome(), `session rejected (session-active-turn): ${REJECTED}; active-turn wait deadline reached`],
			["submitted turns", () => sent("turn/start"), [SUBMISSION]],
		]);
	},
);

timedProviderStory.it(
	"a busy rejection on an idle thread is resubmitted only after its backoff elapses",
	[],
	function* ({ answers, delayElapses, delayNearlyElapses, finalMillisecondElapses, provider, sent }) {
		yield* answers({ "thread/turns/list": page([]), "turn/start": inTurn(BUSY, BUSY, { turn: { id: "followup" } }) });
		const submission = yield* provider.submitInBackground(CONTINUE);
		yield* delayNearlyElapses(5000);
		expect(yield* sent("turn/start")).toEqual([SUBMISSION]);

		yield* finalMillisecondElapses();
		yield* delayElapses(10_000);

		yield* outcomes([
			["submission", () => submission.outcome(), "turn followup on thread"],
			["submitted turns", () => sent("turn/start"), [SUBMISSION, SUBMISSION, SUBMISSION]],
		]);
	},
);

timedProviderStory.it("an invalid request is neither checked for a busy thread nor resubmitted", [], function* ({ answers, methods, provider }) {
	yield* answers({ "turn/start": new WireRejection("Invalid request") });

	const outcome = yield* provider.submit(CONTINUE);

	expect(outcome).toBe("session rejected (session-rejected): Codex rejected the protocol request: Invalid request");
	expect(yield* methods("turn/start", "thread/turns/list", "turn/interrupt")).toEqual(["turn/start"]);
});
