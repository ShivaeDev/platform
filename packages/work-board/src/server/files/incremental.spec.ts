import { Effect, Order } from "effect";
import { expect } from "vitest";
import { fileWatcherStory, watchedFiles } from "#test/fileWatcherStory.ts";

const paths = Array.from({ length: 300 }, (_, index) => `item-${index}.md`);
fileWatcherStory.it(
	"coalesces over 256 writes and shares one index update between readers",
	[watchedFiles(Object.fromEntries(paths.map((path) => [path, "# Before"])))],
	function* ({ readIndex, clearReads, revision, writeFile, notify, nextChange, readPaths }) {
		yield* readIndex();
		clearReads();
		const before = yield* revision();
		for (const path of paths) {
			writeFile(path, "# After");
		}
		yield* notify(paths.flatMap((path) => [path, path]));
		expect(yield* nextChange()).toMatchObject({ _tag: "Changed", paths: expect.arrayContaining(paths) });
		expect(yield* revision()).toBe(before + 1);
		const snapshots = yield* Effect.all([readIndex(), readIndex(), readIndex()], { concurrency: "unbounded" });
		expect(readPaths().sort(Order.String)).toEqual([...paths].sort(Order.String));
		expect(snapshots[0]).toBe(snapshots[1]);
		expect(snapshots[1]).toBe(snapshots[2]);
		expect(snapshots[0]?.documents.map((source) => source.parsed.body)).toEqual(paths.map(() => "# After"));
	},
);

fileWatcherStory.it(
	"ignores socket preparation events without rescanning Markdown",
	[
		watchedFiles({
			".board.sock.starting/pending.md": "# Startup lock",
			".sABC123/pending.md": "# Socket preparation",
			"note.md": "# Notes",
		}),
	],
	function* ({ listedFiles, revision, notify, nextChange, story }) {
		expect((yield* listedFiles()).map((file) => file.path)).toEqual(["note.md"]);
		const scans = story.engine.scans;
		const before = yield* revision();
		yield* notify([".board.sock.starting", ".board.sock.starting/pending.md", ".sABC123", ".sABC123/pending.md", "note.md"]);
		expect(yield* nextChange()).toMatchObject({ _tag: "Changed", paths: ["note.md"] });
		expect(yield* revision()).toBe(before + 1);
		yield* listedFiles();
		expect(story.engine.scans).toBe(scans);
		expect(story.engine.watchedPaths).toEqual([story.engine.notes.root]);
	},
);
