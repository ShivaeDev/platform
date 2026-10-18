import { relative } from "node:path";
import { Effect } from "effect";
import { expect } from "vitest";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { type Folder, folder, startBoard } from "./board.ts";
import { waitFor } from "./live.ts";

interface StartEngine {
	readonly notes: Folder;
	readonly reads: string[];
}

export const boardStartStory = storyKit({
	after: {
		*project(engine) {
			yield* startBoard(engine.notes.root, undefined, (fs) => ({
				...fs,
				readFileString: (path, encoding) =>
					Effect.suspend(() => {
						engine.reads.push(relative(engine.notes.root, path));
						return fs.readFileString(path, encoding);
					}),
			}));
		},
	},
	clock: "live",
	*create() {
		const notes = yield* Effect.acquireRelease(
			Effect.sync(() => folder({})),
			(acquired) => Effect.sync(acquired.remove),
		);
		const engine: StartEngine = { notes, reads: [] };
		return engine;
	},
	inspect: (engine) => ({ reads: engine.reads }),
	name: "board start",
	stages: ["project"],
	verbs: (engine, story) => ({
		waitForReads: (files: readonly string[]) => {
			story.tell(`nobody opens the board while it reads ${files.join(", ")}`);
			return Effect.promise(() => waitFor(() => expect(files.filter((file) => engine.reads.includes(file))).toEqual(files)));
		},
	}),
});

export function startedProject(files: Readonly<Record<string, string>>) {
	return boardStartStory.trait("project", `the board starts over ${Object.keys(files).join(", ")}`, (engine) => {
		for (const [path, source] of Object.entries(files)) {
			engine.notes.write(path, source);
		}
	});
}
