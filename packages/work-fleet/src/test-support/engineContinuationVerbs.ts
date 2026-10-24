import { renameSync } from "node:fs";
import { join } from "node:path";
import { Context, Effect, Layer } from "effect";
import { Fleet } from "#fleet.ts";
import type { FleetConfiguration } from "#policy.ts";
import type { SessionObservation } from "#session/schema.ts";
import { type EngineStory, running } from "#test/engineState.ts";
import { answerReport } from "#test/report.ts";
import { answerWorker } from "#test/workerQuestion.ts";

export function engineContinuationVerbs(state: EngineStory, tell: (line: string) => void) {
	function fixture() {
		return running(state).fixture;
	}
	function root() {
		if (state.root === "") {
			throw new Error("No Markdown Board is configured");
		}
		return state.root;
	}
	return {
		acknowledgementAttempts: () => structuredClone(fixture().acknowledgementAttempts),
		answerReport: (...args: Parameters<typeof answerReport> extends [string, ...infer TRest] ? TRest : never) => {
			tell("record the human answer to the Fleet decision");
			return answerReport(root(), ...args);
		},
		answerWorker: (...args: Parameters<typeof answerWorker> extends [string, ...infer TRest] ? TRest : never) => {
			tell("record the human answer to the worker question");
			return answerWorker(root(), ...args);
		},
		archivedSessions: () => [...fixture().archived],
		loseAcknowledgement: () => {
			tell("the provider loses the next turn acknowledgement");
			fixture().loseAcknowledgement();
		},
		moveBoardWork: (from: string, to: string) => {
			tell(`move Board work ${from} to ${to}`);
			renameSync(join(root(), from), join(root(), to));
		},
		operationReceipt: (id: string) => fixture().operations.get(id),
		providerObservations: () => [...fixture().observations.values()],
		rejectNextTurn: () => {
			tell("the provider rejects the next turn");
			fixture().rejectNextTurn();
		},
		restartWithPolicy: (configure: (policy: FleetConfiguration) => FleetConfiguration) =>
			Effect.gen(function* () {
				tell("restart Fleet with changed host policy");
				const services = yield* Layer.build(running(state).restartLayer(configure));
				state.previousFleet = running(state).fleet;
				running(state).fleet = Context.get(services, Fleet);
			}),
		setObservedExecution: (id: string, execution: SessionObservation["execution"]) => {
			const observation = fixture().observations.get(id);
			if (observation === undefined) {
				throw new Error(`No provider turn ${id} is available`);
			}
			fixture().observations.set(id, { ...observation, execution });
			tell(`the provider reports ${id} ${execution}`);
		},
		setPriority: (...args: Parameters<ReturnType<typeof running>["fixture"]["priority"]>) => {
			tell(`set ${args[0]} priority to ${args[1]}`);
			fixture().priority(...args);
		},
		setWorkerExecution: (execution: SessionObservation["execution"]) => {
			if (fixture().observations.size === 0) {
				throw new Error("No worker turn is available");
			}
			for (const [id, observation] of fixture().observations) {
				fixture().observations.set(id, { ...observation, execution });
			}
			tell(`the provider reports workers ${execution}`);
		},
		steeredTurns: () => structuredClone(fixture().steered),
	};
}
