import { Effect } from "effect";
import { keyStory } from "@shivaedev/changes/test-support/keyStory.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { ChangeObserver } from "#transact.ts";
import { bucketRows } from "./bucketRows.ts";
import { fixture } from "./fixture.ts";
import { postgres } from "./sqlStory.ts";

const records = storyKit({
	create: () =>
		Effect.sync(() => {
			const publishedKeys: unknown[] = [];
			return { bucketRows: fixture<Effect.Success<typeof bucketRows>>(), publishedKeys };
		}),
	name: "bucket rows",
	stages: ["buckets"],
	verbs: (engine) => ({
		bucketRows: engine.bucketRows.get,
		observePublication: <A, E, R>(effect: Effect.Effect<A, E, R>) =>
			Effect.flatMap(ChangeObserver, (observer) =>
				effect.pipe(
					Effect.provideService(ChangeObserver, (event) => {
						if (event._tag === "Published") {
							engine.publishedKeys.push(...event.changes);
						}
						return observer(event);
					}),
				),
			),
		publishedKeys: () => [...new Set(engine.publishedKeys)],
	}),
});

export const writeKeys = storyKit({ extends: [postgres, keyStory, records], name: "PostgreSQL record and bucket writes" });

export function hasBucketRows(seed = false) {
	return writeKeys.trait("buckets", seed ? "a record belongs to list 1 and alice" : "records declare list and owner buckets", function* (engine) {
		const rows = yield* bucketRows;
		engine.bucketRows.set(rows);
		if (seed) {
			yield* rows.rows.insert({ listId: 1, owner: "alice", slug: "note" });
		}
	});
}

export function hasBucketCopySource() {
	return writeKeys.trait("buckets", "a source record can be copied into another list", function* (engine) {
		yield* engine.bucketRows.get().source.insert({ listId: 2, owner: "bob", slug: "copy" });
	});
}
