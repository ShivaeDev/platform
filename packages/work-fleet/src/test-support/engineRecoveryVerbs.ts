import { readdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import type { FleetConfiguration } from "#policy.ts";
import { type EngineStory, running } from "#test/engineState.ts";
import { answerWorker, askWorker } from "#test/workerQuestion.ts";
import { workerReportReply } from "#test/workerReportReply.ts";

export function engineRecoveryVerbs(state: EngineStory, tell: (line: string) => void) {
	const fixture = running(state).fixture;
	return {
		afterRestart: <A, E>(effect: Effect.Effect<A, E, typeof Fleet.Identifier>, configure?: (policy: FleetConfiguration) => FleetConfiguration) => {
			tell("restart Fleet and observe its next action");
			return fixture.restart(effect, configure);
		},
		answerWorker: (...args: Parameters<typeof answerWorker> extends [string, ...infer TRest] ? TRest : never) => answerWorker(state.root, ...args),
		archivedSessions: () => [...fixture.archived],
		askWorker: () => askWorker(fixture).pipe(Effect.provideService(Fleet, running(state).fleet)),
		boardResponseFiles: () => readdirSync(join(state.root, "responses")).filter((file) => !file.startsWith("request-receipt.")),
		disconnectReads: () => [...(state.recovery.disconnect?.reads ?? [])],
		disconnectSubmissions: () => [...(state.recovery.disconnect?.submissions ?? [])],
		failTurnObservation: (turnId: string) => {
			if (!fixture.observations.has(turnId)) {
				throw new Error("No turn is available to fail observation");
			}
			tell(`the provider cannot observe ${turnId}`);
			fixture.failedObservations.add(turnId);
		},
		moveBoardWork: (from: string, to: string) => {
			tell(`move Board work ${from} to ${to}`);
			renameSync(join(state.root, from), join(state.root, to));
		},
		providerOperation: (id: string) => fixture.operations.get(id),
		providerSteers: () => [...fixture.steered],
		reconcileLogged: (id: string) => running(state).fleet.reconcile(id).pipe(Effect.provide(state.logs.layer)),
		source: state.source,
		turnOutputById: (id: string) => fixture.observations.get(id)?.output,
		workerReportReply: (...args: Parameters<typeof workerReportReply> extends [unknown, ...infer TRest] ? TRest : never) =>
			workerReportReply(fixture, ...args),
	};
}
