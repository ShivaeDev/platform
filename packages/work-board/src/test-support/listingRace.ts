import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { searchSnapshot } from "#search/snapshot.ts";
import { folder } from "#test/board.ts";
import { incrementalIndex } from "#test/incrementalIndex.ts";

export function listingRace<A, E, R>(use: (read: Effect.Success<ReturnType<typeof searchSnapshot>>) => Effect.Effect<A, E, R>) {
	return Effect.gen(function* () {
		const notes = folder({ "first.md": "---\nid: first\n---\n# First" });
		yield* Effect.addFinalizer(() => Effect.sync(notes.remove));
		const index = yield* incrementalIndex(notes.root);
		let changed = false;
		const changes = {
			...index.changes,
			files: index.changes.files.pipe(
				Effect.tap(() =>
					Effect.suspend(() => {
						if (changed) {
							return Effect.void;
						}
						changed = true;
						notes.write("added.md", "---\nid: added\n---\n# Added");
						return index.update(["added.md"]);
					}),
				),
			),
		};
		return yield* use(yield* searchSnapshot(notes.root, undefined, changes));
	}).pipe(Effect.provide(NodeServices.layer));
}
