import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Stream } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { homeIn } from "#server/files/home.ts";
import { listMarkdown } from "#server/files/list.ts";
import { watchDirectories } from "#server/files/watchDirectories.ts";
import { type Folder, folder } from "./board.ts";
import { unlinkBeforeStat } from "./fileRaces.ts";

interface FileReader {
	notes: Folder;
	services: Layer.Layer<FileSystem.FileSystem>;
}
export const fileReadingStory = storyKit({
	clock: "live",
	*create() {
		const notes = yield* Effect.acquireRelease(
			Effect.sync(() => folder({})),
			(acquired) => Effect.sync(acquired.remove),
		);
		const engine: FileReader = { notes, services: NodeServices.layer };
		return engine;
	},
	inspect: (engine) => ({ root: engine.notes.root }),
	layer: NodeServices.layer,
	name: "board files",
	stages: ["project"],
	verbs: (engine, story) => ({
		listFiles: () => {
			story.tell("the board lists Markdown files");
			return listMarkdown(engine.notes.root, engine.notes.root).pipe(Effect.provide(engine.services));
		},
		get root() {
			return engine.notes.root;
		},
		selectHome: (file: string) => {
			story.tell(`the board selects ${file} as home`);
			return homeIn(engine.notes.root, file).pipe(Effect.provide(engine.services));
		},
		watchDirectory: () => {
			story.tell("the host starts watching the workspace");
			return watchDirectories(
				engine.notes.root,
				engine.notes.root,
				Effect.void,
				() => Effect.void,
				() => Effect.void,
			).pipe(Effect.provide(engine.services));
		},
	}),
});
export function readableFiles(files: Readonly<Record<string, string>>) {
	return fileReadingStory.trait("project", "the workspace contains readable Markdown", (engine) => {
		for (const [file, source] of Object.entries(files)) {
			engine.notes.write(file, source);
		}
	});
}
export function disappearsBeforeStat(file: string) {
	return fileReadingStory.trait("project", `${file} disappears between resolution and stat`, (engine) => {
		engine.services = unlinkBeforeStat(join(engine.notes.root, file));
	});
}
export function anEndedWatcher() {
	return fileReadingStory.trait("project", "the filesystem watcher ends without an error", (engine) => {
		engine.services = Layer.effect(
			FileSystem.FileSystem,
			Effect.map(FileSystem.FileSystem, (fs) => ({ ...fs, watch: () => Stream.empty })),
		).pipe(Layer.provide(NodeServices.layer));
	});
}
