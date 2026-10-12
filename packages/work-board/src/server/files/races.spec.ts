import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { homeIn } from "#server/files/home.ts";
import { listMarkdown } from "#server/files/list.ts";
import { type Folder, folder } from "#test/board.ts";
import { unlinkBeforeStat } from "#test/fileRaces.ts";

let notes: Folder;

afterEach(() => notes?.remove());

it.live("reports the selected home disappearing between path resolution and stat", function* () {
	notes = folder({ "home.md": "# Home" });
	const result = yield* homeIn(notes.root, "home.md").pipe(Effect.provide(unlinkBeforeStat(join(notes.root, "home.md"))), Effect.result);
	expect(result).toMatchObject({
		_tag: "Failure",
		failure: { _tag: "HomeMissing", message: `The home file home.md is not a markdown file in ${notes.root}` },
	});
});

it.live("continues listing readable files when another file disappears before stat", function* () {
	notes = folder({ "gone.md": "# Removed", "kept.md": "# Readable" });
	const files = yield* listMarkdown(notes.root, notes.root).pipe(Effect.provide(unlinkBeforeStat(join(notes.root, "gone.md"))));
	expect(files.map((file) => file.path)).toEqual(["kept.md"]);
});
