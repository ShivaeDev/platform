import { Layer, type Redacted } from "effect";
import type { PgBossClientFactory } from "@shivaedev/jobs/server/client.ts";
import { notesWorker } from "#modules/notes/server/worker.ts";
import { foundationWorker } from "./foundationWorker.ts";

const modules = [foundationWorker, notesWorker];

export function workerModules(url: Redacted.Redacted<string>, clientFactory?: PgBossClientFactory, max?: number) {
	const clientCacheKey = Symbol("app/worker");
	return Layer.mergeAll(Layer.empty, ...modules.map((module) => module(url, clientFactory, max, clientCacheKey)));
}
