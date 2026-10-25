import { expect } from "vitest";
import { fileWatcherStory, watchedFiles } from "#test/fileWatcherStory.ts";

fileWatcherStory.it(
	"coalesces directory bursts and names edited, added and removed Markdown files",
	[watchedFiles({ "notes/log.md": "# Before", "notes/removed.md": "# Removed" })],
	function* ({ writeFile, removeFile, notify, nextChange, story }) {
		const scans = story.engine.scans;
		writeFile("notes/log.md", "# After");
		writeFile("notes/added.md", "# Added");
		removeFile("notes/removed.md");
		yield* notify(Array.from({ length: 12 }, () => "notes"));
		expect(yield* nextChange()).toEqual({
			_tag: "Changed",
			paths: expect.arrayContaining(["notes/log.md", "notes/added.md", "notes/removed.md"]),
			sequence: expect.any(Number),
		});
		expect(story.engine.scans).toBe(scans + 1);
		expect(story.engine.watchedPaths).toEqual([story.engine.notes.root]);
	},
);

fileWatcherStory.it(
	"ignores hidden and dependency directories before inspecting or rescanning them",
	[watchedFiles({ ".git/state.md": "# Hidden", "node_modules/dependency/note.md": "# Dependency", "notes/log.md": "# Before" })],
	function* ({ writeFile, notify, nextChange, story }) {
		const scans = story.engine.scans;
		const ignored = [".git", ".git/objects", "node_modules", "node_modules/dependency", "notes/.cache", "notes/node_modules"];
		writeFile("notes/log.md", "# After");
		yield* notify([...ignored, "notes/log.md"]);
		expect(yield* nextChange()).toMatchObject({ _tag: "Changed", paths: ["notes/log.md"] });
		expect(story.engine.scans).toBe(scans);
		expect(story.engine.checked.some((path) => ignored.includes(path))).toBe(false);
	},
);

fileWatcherStory.it(
	"announces removed descendants when only their removed directory is reported",
	[watchedFiles({ "notes/log.md": "# Log", "notes/nested/plan.md": "# Plan" })],
	function* ({ removeFile, notify, nextChange, story }) {
		removeFile("notes");
		yield* notify(["notes"]);
		expect(yield* nextChange()).toMatchObject({
			_tag: "Changed",
			paths: expect.arrayContaining(["notes/log.md", "notes/nested/plan.md"]),
		});
		expect(story.engine.watchedPaths).toEqual([story.engine.notes.root]);
	},
);
