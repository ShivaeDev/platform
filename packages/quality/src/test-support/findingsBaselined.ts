import { Effect } from "effect";
import { runQuality } from "./cli.ts";
import { repositoryStory } from "./repositoryStory.ts";

export function findingsBaselined() {
	return repositoryStory.trait("history", "quality baseline write has recorded every finding in quality-baseline.jsonl", (engine) =>
		Effect.promise(() => runQuality(engine.root, "baseline", "write")).pipe(
			Effect.flatMap((run) => (run.status === 0 ? Effect.void : Effect.die(new Error(`quality baseline write failed: ${run.stderr}`)))),
		),
	);
}
