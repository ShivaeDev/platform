import { expect } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { GENERIC_REJECTION_MESSAGE } from "#test/engineProtocolRejections.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { protocolRejections } from "#test/protocolRejections.ts";

for (const failures of [1, 3]) {
	const rejectedProtocolRequests = engineConfiguration("Codex rejects worker submissions over its protocol", protocolRejections(failures));
	isolatedEngine.it(
		`a generic protocol rejection retries the same request before asking: failures=${failures}`,
		[rejectedProtocolRequests],
		function* ({
			waitForProtocolOutcome,
			protocolRequests,
			protocolSubmissionTimes,
			advanceProtocolBackoff,
			publishedDecisions,
			prepareWork,
			fleet,
		}) {
			const waits = failures === 1 ? ([0] as const) : ([0, 1] as const);

			yield* prepareWork("one");
			const dispatching = yield* fleet.dispatch("one").pipe(Effect.forkChild);
			for (const index of waits) {
				yield* Effect.raceFirst(
					advanceProtocolBackoff(index),
					waitForProtocolOutcome().pipe(Effect.map((early) => expect(early.decision).toBeUndefined())),
				);
			}
			yield* Fiber.join(dispatching);
			const record = yield* waitForProtocolOutcome();
			expect(record.attempts).toMatchObject([{ operationId: "operation-1", sessionId: "worker-thread" }]);
			if (failures === 1) {
				expect(record.step).toBe("working");
				expect(record.attempts[0]?.receipt).toEqual({ sessionId: "worker-thread", turnId: "worker-turn" });
				expect(record.decision).toBeUndefined();
				expect(publishedDecisions()).toHaveLength(0);
			} else {
				expect(record.step).toBe("waiting");
				expect(record.decision).toMatchObject({
					code: "session-rejected",
					reason: `Codex rejected the protocol request: ${GENERIC_REJECTION_MESSAGE}`,
				});
				expect(publishedDecisions()).toEqual([(yield* fleet.get("one")).value.decision?.reason]);
			}
			expect(protocolSubmissionTimes()).toEqual(failures === 1 ? [0, 30_000] : [0, 30_000, 90_000]);
			const submissions = protocolRequests().filter((request) => request.method === "turn/start");
			expect(submissions.map((request) => request.params)).toEqual(protocolSubmissionTimes().map(() => submissions[0]?.params));
			expect(protocolRequests().filter((request) => request.method === "thread/start")).toMatchObject([{ params: { cwd: "/synthetic" } }]);
		},
	);
}

for (const message of [
	"Invalid request",
	"Invalid params: unknown field",
	"Permission denied",
	"Permission required",
	"Quota exceeded",
	"Something went wrong. Permission denied. Request ID: synthetic-request",
]) {
	const rejectedProtocolRequest = engineConfiguration("Codex rejects worker submissions over its protocol", protocolRejections(message));
	isolatedEngine.it(
		`a specific rejection asks immediately: ${message}`,
		[rejectedProtocolRequest],
		function* ({ protocolSubmissionTimes, publishedDecisions, prepareWork, fleet }) {
			yield* prepareWork("one");

			const rejected = (yield* fleet.dispatch("one")).value;
			expect(rejected).toMatchObject({ decision: { reason: `Codex rejected the protocol request: ${message}` }, step: "waiting" });
			expect(publishedDecisions()).toEqual([(yield* fleet.get("one")).value.decision?.reason]);
			expect(protocolSubmissionTimes()).toEqual([0]);
		},
	);
}
