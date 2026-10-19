import { expect } from "vitest";
import { indexRevisions } from "#test/indexRevisions.ts";
import { indexState } from "#test/indexState.ts";
import { indexedFiles, indexStory } from "#test/indexStory.ts";

indexStory.it(
	"matches a fresh full index after seeded random edits, additions, deletions, renames and folder moves, including ambiguous and unresolved references",
	[indexedFiles(indexRevisions().initialFiles)],
	function* ({ readIndex, freshIndex, invalidate, writeFile, removeFile, moveFile, moveFolder }) {
		const { files, movedPaths, random, source } = indexRevisions();
		yield* readIndex();
		for (let step = 0; step < 80; step += 1) {
			const operation = random(5);
			const selected = [...files][random(files.size)] ?? "empty.md";
			let changed: string[] = [];
			if (operation === 0) {
				writeFile(selected, step % 7 === 0 ? "---\nid: [invalid\n---\n# Damaged" : source(step));
				files.add(selected);
				changed = [selected];
			} else if (operation === 1 || files.size === 0) {
				const added = `added-${step}.md`;
				writeFile(added, source(step));
				files.add(added);
				changed = [added];
			} else if (operation === 2) {
				removeFile(selected);
				files.delete(selected);
				changed = [selected];
			} else if (operation === 4) {
				moveFolder("nested", `folder-${step}`);
				changed = movedPaths("nested", `folder-${step}`);
			} else {
				const moved = `nested/moved-${step}.md`;
				writeFile(moved, "");
				moveFile(selected, moved);
				files.delete(selected);
				files.add(moved);
				changed = [selected, moved];
			}
			yield* invalidate(changed);
			expect(indexState(yield* readIndex()), `step ${step}, operation ${operation}`).toEqual(indexState(yield* freshIndex()));
		}
	},
);
