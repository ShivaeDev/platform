import { expect } from "vitest";
import { indexRevisions } from "#test/indexRevisions.ts";
import { indexedFiles, indexStory } from "#test/indexStory.ts";

const STEPS = 80;

indexStory.it(
	"after each of 80 seeded random edits, additions, deletions, renames and folder moves the index equals a fresh scan",
	[indexedFiles(indexRevisions().initialFiles)],
	function* ({ editorAdds, editorMoves, editorMovesFolderIfPresent, editorRemoves, editorWrites, indexDifferences, watcherReports }) {
		const { files, movedPaths, random, source } = indexRevisions();
		for (let step = 0; step < STEPS; step += 1) {
			const operation = random(5);
			const selected = [...files][random(files.size)] ?? "empty.md";
			let changed: string[];
			if (operation === 0) {
				yield* editorWrites(selected, step % 7 === 0 ? "---\nid: [invalid\n---\n# Damaged" : source(step));
				files.add(selected);
				changed = [selected];
			} else if (operation === 1 || files.size === 0) {
				const added = `added-${step}.md`;
				yield* editorAdds(added, source(step));
				files.add(added);
				changed = [added];
			} else if (operation === 2) {
				yield* editorRemoves(selected);
				files.delete(selected);
				changed = [selected];
			} else if (operation === 4) {
				yield* editorMovesFolderIfPresent("nested", `folder-${step}`);
				changed = movedPaths("nested", `folder-${step}`);
			} else {
				const moved = `nested/moved-${step}.md`;
				yield* editorWrites(moved, "");
				yield* editorMoves(selected, moved);
				files.delete(selected);
				files.add(moved);
				changed = [selected, moved];
			}

			yield* watcherReports(...changed);

			expect(yield* indexDifferences(), `step ${step}, operation ${operation}`).toEqual([]);
		}
	},
);
