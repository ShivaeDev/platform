import { Deferred, Effect } from "effect";
import type { FleetRecord } from "#model.ts";
import { type EngineStory, running } from "#test/engineState.ts";
import { engineTimingState } from "#test/engineTimingState.ts";

export function engineTimingVerbs(state: EngineStory, tell: (line: string) => void) {
	function timing() {
		return engineTimingState(state);
	}
	function active() {
		const value = timing().active;
		if (value === undefined) {
			throw new Error("No active worker turn is configured");
		}
		return value;
	}
	function gate(name: "entered" | "resume" | "acknowledgement" | "sessionReached" | "turnReached") {
		const value = timing()[name];
		if (value === undefined) {
			throw new Error(`No ${name} gate is configured`);
		}
		return value;
	}
	return {
		activateSteeredTurn: () => {
			active().activate();
			tell("another operation activates the steered worker turn");
		},
		answerRecoveries: () => timing().recoveries,
		completeSteeredTurn: () => {
			active().complete();
			tell("the steered worker turn completes");
		},
		pendingAnswerAttempt: () => timing().pendingAttempt,
		receiveAnswerDuringBoardRead: () => {
			const value = timing();
			const acknowledgement = gate("acknowledgement");
			value.beforeObservation = Effect.gen(function* () {
				const pending = (yield* running(state).fleet.get("one")).value.attempts.at(-1);
				if (pending?.status !== "submitting") {
					return;
				}
				value.beforeObservation = Effect.void;
				value.pendingAttempt = pending;
				yield* Deferred.succeed(acknowledgement, undefined);
				while ((yield* running(state).fleet.get("one")).value.attempts.at(-1)?.receipt === undefined) {
					yield* Effect.yieldNow;
				}
				yield* Effect.yieldNow;
			}).pipe(Effect.orDie);
			tell("the provider receipt will land during the next Board read");
		},
		releaseTimingGate: (name: "resume" | "acknowledgement" = "resume") => {
			tell(`release ${name}`);
			return Deferred.succeed(gate(name), undefined);
		},
		steerCalls: () => timing().steers,
		steeredPollTimes: () => [...active().pollTimes],
		steeredSubmissions: () => [...active().submissions],
		steerRequests: () => structuredClone(timing().steerRequests ?? []),
		waitForSteeredTurn: () => active().waiting,
		waitForStoredRecord: (id: string, ready: (record: FleetRecord) => boolean) =>
			Effect.gen(function* () {
				tell(`wait for ${id}'s durable transition`);
				while (true) {
					const record = (yield* running(state).fleet.get(id)).value;
					if (ready(record)) {
						return record;
					}
					yield* Effect.yieldNow;
				}
			}).pipe(Effect.timeout("5 seconds")),
		waitForTimingGate: (name: "entered" | "sessionReached" | "turnReached" = "entered") => {
			tell(`wait for ${name}`);
			return Deferred.await(gate(name));
		},
	};
}
