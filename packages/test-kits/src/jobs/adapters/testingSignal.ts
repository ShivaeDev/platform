import { Effect } from "effect";
import { queueSignal } from "#jobs/adapters/queueSignal.ts";

export interface InspectionSignal {
	readonly revision: Effect.Effect<number>;
	readonly waitForChange: (after: number) => Effect.Effect<number>;
}

export function testingSignal() {
	const local = queueSignal();
	let inspection: InspectionSignal | undefined;
	const revisions = Effect.suspend(() => Effect.all([local.revision, inspection?.revision ?? Effect.succeed(0)]));
	const revision = Effect.map(revisions, ([localRevision, inspectionRevision]) => localRevision + inspectionRevision);
	return {
		changed: local.changed,
		observe: (signal: InspectionSignal) => {
			inspection = signal;
		},
		revision,
		waitForChange: (after: number) =>
			Effect.gen(function* () {
				const [localRevision, inspectionRevision] = yield* revisions;
				if (localRevision + inspectionRevision !== after) {
					return localRevision + inspectionRevision;
				}
				const waits = [local.waitForChange(localRevision)];
				if (inspection !== undefined) {
					waits.push(inspection.waitForChange(inspectionRevision));
				}
				yield* Effect.raceAll(waits);
				return yield* revision;
			}),
	};
}
