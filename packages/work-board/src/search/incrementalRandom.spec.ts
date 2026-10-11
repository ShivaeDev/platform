import { renameSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { folder } from "#test/board.ts";
import { incrementalIndex } from "#test/incrementalIndex.ts";
import { indexState } from "#test/indexState.ts";

it("matches a fresh full index after seeded random edits, additions, deletions and renames, including ambiguous and unresolved references", async () => {
	let seed = 517;
	function random(limit: number) {
		seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
		return Math.floor(seed / 65_536) % limit;
	}
	function source(step: number) {
		const id = random(8);
		const target = random(8);
		return `---\nid: item.${id}\nkind: task\nstatus: planned\nowner: agent\ncriteria:\n - id: done\n   text: Revision ${step}\nrelationships:\n - kind: depends_on\n   target: item.${target}#done\nattention:\n - id: review\n   kind: review\n   state: open\n   response_from: [maintainer]\n   reason: Review ${step}\n   unblocks: [item.${target}#done]\nevidence:\n - source: file-${random(8)}.md\n   criterion: item.${target}#done\n---\n# Revision ${step}\n\nRead [a source](file-${random(8)}.md).\n`;
	}
	const files = new Set(Array.from({ length: 8 }, (_, i) => `file-${i}.md`));
	const notes = folder({
		...Object.fromEntries([...files].map((file, i) => [file, source(i)])),
		"board.md": "---\nid: board\nkind: board\nitems: [item.0, item.1, item.2, missing]\n---\n# Board",
	});
	const index = await incrementalIndex(notes.root);
	const operations = new Set<number>();
	try {
		await index.read();
		for (let step = 0; step < 80; step += 1) {
			const operation = random(4);
			operations.add(operation);
			const selected = [...files][random(files.size)] ?? "empty.md";
			let changed: string[] = [];
			if (operation === 0) {
				notes.write(selected, step % 7 === 0 ? "---\nid: [invalid\n---\n# Damaged" : source(step));
				files.add(selected);
				changed = [selected];
			} else if (operation === 1 || files.size === 0) {
				const added = `added-${step}.md`;
				notes.write(added, source(step));
				files.add(added);
				changed = [added];
			} else if (operation === 2) {
				unlinkSync(join(notes.root, selected));
				files.delete(selected);
				changed = [selected];
			} else {
				const moved = `nested/moved-${step}.md`;
				notes.write(moved, "");
				renameSync(join(notes.root, selected), join(notes.root, moved));
				files.delete(selected);
				files.add(moved);
				changed = [selected, moved];
			}
			index.update(changed);
			expect(indexState(await index.read()), `step ${step}, operation ${operation}`).toEqual(indexState(await index.fresh()));
		}
		expect([...operations].sort()).toEqual([0, 1, 2, 3]);
	} finally {
		await index.close();
		notes.remove();
	}
});
