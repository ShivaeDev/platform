import { Effect } from "effect";
import type { KeysetPageQuery } from "@shivaedev/sql/keysetPage.ts";
import type { Listing } from "#server/engine.ts";
import { JobEngine } from "#server/engine.ts";
export const listJobs = Effect.fn("PgBossOperations.listJobs")(function* (listing: Listing, queue: string, query: KeysetPageQuery) {
	const engine = yield* JobEngine;
	return yield* engine.listJobs(listing, queue, query);
});
