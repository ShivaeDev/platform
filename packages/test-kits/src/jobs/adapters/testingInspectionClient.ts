import { Context, Effect, Exit, Layer, Scope } from "effect";
import type { EngineClient } from "@shivaedev/jobs/server/engineClient.ts";
import { PgBossInspection, type PgBossInspectionService } from "@shivaedev/jobs/server/inspection.ts";
import { PgBoss } from "@shivaedev/jobs/server/PgBoss.ts";
import type { TestingWork } from "#jobs/testingIdle.ts";
import type { InspectionSignal } from "#jobs/testingSignal.ts";

const settleBatches = Effect.fnUntraced(function* (inspection: PgBossInspectionService, work: TestingWork) {
	for (const batch of work.batches) {
		if (batch.settled) {
			continue;
		}
		const stored = yield* inspection.storedJobs({ name: batch.name });
		batch.settled = !stored.some((job) => job.state === "active" && batch.jobs.get(job.id) === job.retryCount);
	}
});

export function testingInspectionClient(
	source: EngineClient,
	schema: string,
	work: TestingWork,
	changed: () => void,
	observe: (inspection: PgBossInspectionService, signal: InspectionSignal) => void,
): EngineClient {
	const scope = Effect.runSync(Scope.make());
	const start = source.start.bind(source);
	const stop = source.stop.bind(source);
	async function startObserved() {
		const result = await start();
		const context = await Effect.runPromise(
			Layer.buildWithScope(
				PgBossInspection.layer.pipe(Layer.provide(Layer.succeed(PgBoss, { client: source, reused: false, schema, stop: undefined }))),
				scope,
			),
		);
		const inspection = Context.get(context, PgBossInspection);
		await Effect.runPromise(
			Effect.gen(function* () {
				const changes = yield* inspection.changes();
				observe(inspection, changes);
				const from = yield* changes.revision;
				yield* Effect.forkScoped(
					Effect.gen(function* () {
						let revision = from;
						while (true) {
							revision = yield* changes.waitForChange(revision);
							yield* settleBatches(inspection, work);
							changed();
						}
					}),
				);
			}).pipe(Effect.provideService(Scope.Scope, scope)),
		);
		return result;
	}
	const stopObserved: EngineClient["stop"] = async (options) => {
		await Promise.all([Effect.runPromise(Scope.close(scope, Exit.void)), stop(options)]);
	};
	return new Proxy(source, {
		get(target, property) {
			if (property === "start") {
				return startObserved;
			}
			if (property === "stop") {
				return stopObserved;
			}
			const value: unknown = Reflect.get(target, property);
			return typeof value === "function" ? value.bind(target) : value;
		},
	});
}
