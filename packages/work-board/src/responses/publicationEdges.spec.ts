import { constants, renameSync } from "node:fs";
import { open, readdir } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { publishIn } from "#responses/publishIn.ts";
import { type Folder, folder } from "#test/board.ts";

let notes: Folder;
afterEach(() => notes?.remove());

it("refuses publication when an external process moves the already-open write directory", async () => {
	notes = folder({ "responses/existing.md": "Existing feedback" });
	const target = await open(join(notes.root, "responses"), constants.O_RDONLY | constants.O_DIRECTORY);
	try {
		renameSync(join(notes.root, "responses"), join(notes.root, "moved"));
		await expect(publishIn(target, notes.root, notes.root, "response.edge", "New feedback")).rejects.toMatchObject({
			code: "Conflict",
			message: "The write boundary changed.",
		});
		expect(await readdir(join(notes.root, "moved"))).toEqual(["existing.md"]);
	} finally {
		await target.close();
	}
});
