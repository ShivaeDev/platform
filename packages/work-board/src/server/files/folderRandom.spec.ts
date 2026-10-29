import { Order } from "effect";
import { expect } from "vitest";
import { fileWatcherStory, watchedFiles } from "#test/fileWatcherStory.ts";

const STEPS = 30;

fileWatcherStory.it(
	"keeps the listing and index equal to the folder contents after seeded random folder additions, moves and removals",
	[watchedFiles({ "folder-0/first.md": "# First", "folder-0/nested/second.md": "# Second", "index.md": "# Index" })],
	function* ({ readIndex, listedFiles, writeFile, removeFile, moveFile, notify, nextChange }) {
		let seed = 91;
		function random(limit: number) {
			seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
			return Math.floor(seed / 65_536) % limit;
		}
		const files = new Set(["index.md", "folder-0/first.md", "folder-0/nested/second.md"]);
		const folders = new Set(["folder-0"]);
		function inside(folder: string) {
			return [...files].filter((file) => file.startsWith(`${folder}/`));
		}
		yield* readIndex();
		for (let step = 1; step <= STEPS; step += 1) {
			const existing = [...folders][random(folders.size)];
			const operation = existing === undefined ? 0 : random(3);
			let reported: string[];
			if (operation === 0 || existing === undefined) {
				const added = `folder-${step}`;
				writeFile(`${added}/note.md`, `# Note ${step}`);
				writeFile(`${added}/deep/plan.md`, `# Plan ${step}`);
				files.add(`${added}/note.md`).add(`${added}/deep/plan.md`);
				folders.add(added);
				reported = [`${added}/note.md`, `${added}/deep/plan.md`, `${added}/deep`, added];
			} else if (operation === 1) {
				const moved = `folder-${step}`;
				moveFile(existing, moved);
				for (const file of inside(existing)) {
					files.delete(file);
					files.add(`${moved}/${file.slice(existing.length + 1)}`);
				}
				folders.delete(existing);
				folders.add(moved);
				reported = [existing, moved];
			} else {
				removeFile(existing);
				for (const file of inside(existing)) {
					files.delete(file);
				}
				folders.delete(existing);
				reported = [existing];
			}
			yield* notify(reported);
			expect(yield* nextChange(), `step ${step}`).toMatchObject({ _tag: "Changed" });
			const expected = [...files].sort(Order.String);
			expect((yield* listedFiles()).map((file) => file.path).sort(Order.String), `step ${step}`).toEqual(expected);
			expect((yield* readIndex()).documents.map((indexed) => indexed.file).sort(Order.String), `step ${step}`).toEqual(expected);
		}
	},
);
