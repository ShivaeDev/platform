import { Option } from "effect";
import { named } from "#test/jobsNames.ts";
import { Sync } from "#test/jobsPages.ts";
import { jobsStory } from "#test/jobsStory.ts";

export function storedSyncFailure(output: object) {
	return jobsStory.trait("jobs", "an older pg-boss writer failed sync with its own failure output", function* (engine) {
		const id = Option.getOrThrow(yield* engine.jobs.enqueue(Sync, { key: "sync-key" }, { retryLimit: 0 }));
		named(engine, id, "failed sync");
		yield* engine.failSync(id, output);
	});
}
