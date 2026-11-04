import { Deferred, Effect, Stream } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { readKeys } from "@shivaedev/changes/keys.ts";
import { run } from "#engine/runScheduler.ts";
import { Fleet } from "#fleet.ts";
import { fleetRecords } from "#fleetRecords.ts";
import { type EngineStory, running } from "#test/engineState.ts";
import { schedulerSnapshot } from "#test/schedulerSnapshot.ts";

export function engineRaceVerbs(state: EngineStory, tell: (line: string) => void) {
	function gate(name: string) {
		const value = state.recovery.gates[name];
		if (value === undefined) {
			throw new Error(`No ${name} gate is configured`);
		}
		return value;
	}
	return {
		armDecisionRace: () => {
			if (state.recovery.barrier === undefined) {
				throw new Error("No decision write race is configured");
			}
			tell("both decision writes reach their commit");
			state.recovery.barrier.arm();
		},
		awaitRecordedReceipt: (id: string) =>
			Reactivity.stream(running(state).fleet.get(id), readKeys([fleetRecords.item(id)])).pipe(
				Stream.filter(({ value }) => value.attempts[0]?.receipt !== undefined),
				Stream.take(1),
				Stream.runDrain,
			),
		awaitRecordedStage: (id: string, step: string) =>
			Reactivity.stream(running(state).fleet.get(id), readKeys([fleetRecords.item(id)])).pipe(
				Stream.filter(({ value }) => value.step === step),
				Stream.take(1),
				Stream.runDrain,
			),
		failStalledProvider: () => {
			if (state.recovery.faultyProvider === undefined) {
				throw new Error("No stalled provider is configured");
			}
			tell("the provider stops answering stalled recovery");
			state.recovery.faultyProvider.fail();
		},
		holdNextObservation: () => {
			tell("hold the next provider observation");
			state.recovery.holdObservation = true;
		},
		releaseGate: (name: string) => {
			tell(`release ${name}`);
			return Deferred.succeed(gate(name), undefined);
		},
		scheduleSnapshot: () => {
			tell("run a scheduler cycle while dispatch changes its snapshot");
			return schedulerSnapshot(running(state).fleet);
		},
		startScheduler: () => {
			tell("start the autonomous Fleet scheduler");
			return Effect.scoped(run(Effect.succeed({ github: 5, provider: 5 }))).pipe(
				Effect.provideService(Fleet, running(state).fleet),
				Effect.forkChild,
			);
		},
		waitForGate: (name: string) => {
			tell(`wait for ${name}`);
			return Deferred.await(gate(name));
		},
	};
}
