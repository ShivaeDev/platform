import { Effect, Layer } from "effect";
import { inspectionReads } from "#server/adapters/inspectionReads.ts";
import { jobEngine } from "#server/adapters/jobEngine.ts";
import { JobEngine } from "#server/engine.ts";
import { InspectionEngine } from "#server/InspectionEngine.ts";
import { JobQueues } from "#server/JobQueues.ts";
import { PgBoss } from "#server/PgBoss.ts";
import { PgBossInspectionReads } from "#server/services/inspection/service.ts";
import { PgBossOperations } from "#server/services/operations/service.ts";
export function operationsLayer(names: readonly string[]) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const acquired = yield* PgBoss;
			const ports = Layer.mergeAll(
				Layer.succeed(JobEngine, jobEngine(acquired.client, acquired.schema)),
				Layer.succeed(InspectionEngine, inspectionReads(acquired.client, acquired.schema ?? "pgboss")),
				Layer.succeed(JobQueues, names),
				Layer.succeed(PgBoss, acquired),
			);
			return Layer.mergeAll(Layer.fresh(PgBossOperations.layer), Layer.fresh(PgBossInspectionReads.layer)).pipe(Layer.provide(ports));
		}),
	);
}
