import { Deferred, Effect } from "effect";
import { SessionFailure } from "#session/schema.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";

const queueFull = new SessionFailure({ code: "session-queue-full", message: "Request queue is full", reason: "rejected" });
function signalled<E>(reached: Deferred.Deferred<void>, gate: Effect.Effect<void, E>) {
	return Deferred.succeed(reached, undefined).pipe(Effect.andThen(gate));
}
export function launchAcknowledgement(kind: "slow" | "session" | "turn" | "capacity" | "background") {
	return engineConfiguration(`the ${kind} launch acknowledgement arrives after its pass`, (state) =>
		Effect.gen(function* () {
			const entered = yield* Deferred.make<void>();
			const acknowledgement = yield* Deferred.make<void>();
			const sessionReached = yield* Deferred.make<void>();
			const turnReached = yield* Deferred.make<void>();
			state.timing = { acknowledgement, entered, recoveries: 0, sessionReached, steers: 0, turnReached };
			if (kind === "slow") {
				return { sessionAcknowledgementGate: signalled(entered, Deferred.await(acknowledgement)) };
			}
			if (kind === "session") {
				return { sessionAcknowledgementGate: signalled(entered, Effect.never) };
			}
			if (kind === "turn") {
				return { acknowledgementGate: signalled(entered, Effect.never), lostAcknowledgement: true };
			}
			if (kind === "background") {
				return {
					acknowledgementGate: signalled(turnReached, Effect.never),
					backlog: 3,
					concurrency: 3,
					lostAcknowledgement: true,
					sessionAcknowledgementGate: signalled(sessionReached, Effect.sleep("1500 millis").pipe(Effect.andThen(Effect.fail(queueFull)))),
				};
			}
			let turns = 0;
			return {
				acknowledgementGate: signalled(entered, Effect.never),
				backlog: 3,
				concurrency: 3,
				lostAcknowledgement: true,
				submissionFailure: (call: "session" | "turn") => {
					if (call === "turn") {
						turns += 1;
					}
					return call === "turn" && turns === 2 ? queueFull : undefined;
				},
			};
		}),
	);
}
