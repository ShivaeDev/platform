import { Deferred, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
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
	function storedRecord(id: string, ready: (record: FleetRecord) => boolean) {
		return Effect.gen(function* () {
			while (true) {
				const record = (yield* running(state).fleet.get(id)).value;
				if (ready(record)) {
					return record;
				}
				yield* Effect.yieldNow;
			}
		}).pipe(Effect.timeout("5 seconds"));
	}
	let hungContinuation: Fiber.Fiber<unknown, unknown> | undefined;
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
		continueIntoHungTurn: (id: string) =>
			Effect.gen(function* () {
				active().activate();
				tell(`Fleet continues ${id} while another operation keeps its worker turn active`);
				hungContinuation = yield* running(state).fleet.continue(id, "Continue after the steered turn").pipe(Effect.forkChild);
				yield* active().waiting;
			}),
		outlastHungTurn: (id: string) =>
			Effect.gen(function* () {
				tell("five minutes pass while the worker turn stays active");
				yield* TestClock.adjust("5 minutes");
				if (hungContinuation !== undefined) {
					yield* Fiber.join(hungContinuation);
				}
				return yield* storedRecord(id, (record) => record.launchRetry !== undefined);
			}),
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
		steeredPollIntervals: () =>
			active()
				.pollTimes.slice(1)
				.map((time, index) => time - (active().pollTimes[index] ?? time)),
		steeredPollTimes: () => [...active().pollTimes],
		steeredSubmissions: () => [...active().submissions],
		steerRequests: () => structuredClone(timing().steerRequests ?? []),
		waitForSteeredTurn: () => active().waiting,
		waitForStoredRecord: (id: string, ready: (record: FleetRecord) => boolean) => {
			tell(`wait for ${id}'s durable transition`);
			return storedRecord(id, ready);
		},
		waitForTimingGate: (name: "entered" | "sessionReached" | "turnReached" = "entered") => {
			tell(`wait for ${name}`);
			return Deferred.await(gate(name));
		},
	};
}
