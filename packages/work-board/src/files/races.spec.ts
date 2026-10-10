import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, expect, it } from "vitest";
import { homeIn } from "#files/home.ts";
import { listMarkdown } from "#files/list.ts";
import { type Folder, folder } from "#test/board.ts";
import { unlinkBeforeStat } from "#test/fileRaces.ts";

let notes: Folder;
afterEach(() => notes?.remove());

it("reports the selected home disappearing between path resolution and stat", async () => {
	notes = folder({ "home.md": "# Home" });
	const result = await Effect.runPromise(
		homeIn(notes.root, "home.md").pipe(Effect.provide(unlinkBeforeStat(join(notes.root, "home.md"))), Effect.result),
	);
	expect(result).toMatchObject({
		_tag: "Failure",
		failure: { _tag: "HomeMissing", message: `The home file home.md is not a markdown file in ${notes.root}` },
	});
});

it("continues listing readable files when another file disappears before stat", async () => {
	notes = folder({ "gone.md": "# Removed", "kept.md": "# Readable" });
	const files = await Effect.runPromise(listMarkdown(notes.root, notes.root).pipe(Effect.provide(unlinkBeforeStat(join(notes.root, "gone.md")))));
	expect(files.map((file) => file.path)).toEqual(["kept.md"]);
});
