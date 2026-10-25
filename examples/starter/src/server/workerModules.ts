import { Layer, type Redacted } from "effect";
import type { PgBossClientFactory } from "@shivaedev/effect-pg-boss/server/client.ts";
import { notesWorker } from "#modules/notes/server/worker.ts";

const foundationWorker: (url: Redacted.Redacted<string>, clientFactory?: PgBossClientFactory, max?: number) => Layer.Layer<never> = () => Layer.empty;
const modules = [foundationWorker, notesWorker];

export function workerModules(url: Redacted.Redacted<string>, clientFactory?: PgBossClientFactory, max?: number) {
	return Layer.mergeAll(Layer.empty, ...modules.map((module) => module(url, clientFactory, max)));
}
