import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { attentionVerbs } from "./attentionVerbs.ts";
import { folder } from "./board.ts";
import { createBoard } from "./storyEngine.ts";

export const workspaceStory = storyKit({
	clock: "live",
	create: createBoard,
	name: "workspace files",
	stages: ["project"],
	verbs: (engine, story) => ({
		...attentionVerbs(engine, story.tell),
		anotherFolder: (files: Readonly<Record<string, string>>) =>
			Effect.acquireRelease(
				Effect.sync(() => {
					story.tell("an outside folder exists beyond the project");
					return folder(files);
				}),
				(notes) => Effect.sync(notes.remove),
			),
		notes: engine.notes,
	}),
});

export function workspaceFiles(files: Readonly<Record<string, string>>, line = "the project contains publication files") {
	return workspaceStory.trait("project", `${line}: ${Object.keys(files).join(", ")}`, (engine) => {
		for (const [path, source] of Object.entries(files)) {
			engine.notes.write(path, source);
		}
	});
}
