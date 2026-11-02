import { Effect, Layer } from "effect";
import { makePgBossTesting } from "@shivaedev/jobs/server/testing.ts";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { Store } from "@shivaedev/rate-limit/Store.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { CountWords } from "#modules/notes/server/jobs.ts";
import { noteProducer } from "#modules/notes/server/producer.ts";
import { NoteSource } from "#modules/notes/server/Source.ts";
import { JobsClientFactory } from "#server/JobsClientFactory.ts";
import { jobsLayer } from "#server/jobsLayer.ts";
import { app } from "./application.ts";

export function replacementPorts(title: string, options: { readonly failEnqueue?: boolean } = {}) {
	return app.trait("hosting", "a replacement Layer supplies the note source, a one-note quota and the note queue", function* (engine) {
		const database = yield* PostgresTestDatabase;
		const jobs = makePgBossTesting();
		if (options.failEnqueue) {
			yield* jobs.failNextSend(CountWords);
		}
		const queue = noteProducer.pipe(
			Layer.provide(jobsLayer(database.url, 1)),
			Layer.provide(Layer.succeed(JobsClientFactory, jobs.clientFactory)),
			Layer.orDie,
		);
		const quota = Layer.effect(
			Store,
			Effect.map(Store, (store) => ({ consume: (request) => store.consume({ ...request, per: 1 }) })),
		).pipe(Layer.provide(memoryStore));
		engine.hostOptions = {
			...engine.hostOptions,
			replacements: Layer.mergeAll(Layer.succeed(NoteSource, { title: () => Effect.succeed(title) }), quota, queue),
		};
	});
}
