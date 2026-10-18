import { Effect } from "effect";
import type { Engine } from "./applicationState.ts";

export function sessionVerbs(engine: Engine, tell: (line: string) => void) {
	return {
		readConcurrentProfiles: Effect.fn("AppStory.readConcurrentProfiles")(function* (names: readonly string[]) {
			tell(`${names.join(", ")} read their profiles concurrently`);
			return yield* Effect.all(
				names.map((name) => {
					const actor = engine.actors.get(name);
					if (actor === undefined) {
						throw new Error(`No signed-in account ${name}`);
					}
					return actor.notes.whoami();
				}),
				{ concurrency: "unbounded" },
			);
		}),
	};
}
