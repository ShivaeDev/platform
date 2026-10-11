import { constants, renameSync } from "node:fs";
import { open, readdir } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { publishIn } from "#responses/publishIn.ts";
import { type Folder, folder } from "#test/board.ts";

let notes: Folder;

afterEach(() => notes?.remove());

it.live("refuses publication when an external process moves the already-open write directory", function* () {
	notes = folder({ "responses/existing.md": "Existing feedback" });
	const target = yield* Effect.promise(() => open(join(notes.root, "responses"), constants.O_RDONLY | constants.O_DIRECTORY));
	try {
		renameSync(join(notes.root, "responses"), join(notes.root, "moved"));
		yield* Effect.promise(() =>
			expect(publishIn(target, notes.root, notes.root, "response.edge", "New feedback")).rejects.toMatchObject({
				_tag: "Conflict",
				message: "The write boundary changed.",
			}),
		);
		expect(yield* Effect.promise(() => readdir(join(notes.root, "moved")))).toEqual(["existing.md"]);
	} finally {
		yield* Effect.promise(() => target.close());
	}
});
