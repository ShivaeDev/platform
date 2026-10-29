import { Effect, Layer, type Redacted } from "effect";
import { notesWorker } from "#modules/notes/server/worker.ts";
import { foundationWorker } from "./foundationWorker.ts";
import { JobsClientFactory } from "./JobsClientFactory.ts";

const modules = [foundationWorker, notesWorker];

export function workerModules(url: Redacted.Redacted<string>, max?: number) {
	const clientCacheKey = Symbol("app/worker");
	return Layer.unwrap(
		Effect.map(JobsClientFactory, (factory) => Layer.mergeAll(Layer.empty, ...modules.map((module) => module(url, factory, max, clientCacheKey)))),
	);
}
