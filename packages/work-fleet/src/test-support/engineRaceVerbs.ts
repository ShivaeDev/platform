import { Deferred, Effect } from "effect";
import { run } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
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
		awaitRecordedReceipt: Effect.fnUntraced(function* (id: string) {
			while ((yield* running(state).fleet.get(id)).value.attempts[0]?.receipt === undefined) {
				yield* Effect.yieldNow;
			}
		}),
		awaitRecordedStage: Effect.fnUntraced(function* (id: string, step: string) {
			while ((yield* running(state).fleet.get(id)).value.step !== step) {
				yield* Effect.yieldNow;
			}
		}),
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
			return Effect.scoped(run(Effect.sleep("5 millis"))).pipe(Effect.provideService(Fleet, running(state).fleet), Effect.forkChild);
		},
		waitForGate: (name: string) => {
			tell(`wait for ${name}`);
			return Deferred.await(gate(name));
		},
	};
}
