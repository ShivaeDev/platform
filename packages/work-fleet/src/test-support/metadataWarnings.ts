import { NodeServices } from "@effect/platform-node";
import { Context, Effect, FileSystem, Layer } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { BoardGateway } from "#policy.ts";
import { boardReads } from "#test/boardReads.ts";
import { captureLogs } from "#test/captureLogs.ts";

export const metadataWarnings = storyKit({
	*create() {
		const fixture = yield* boardReads(1);
		const board = Context.get(yield* Layer.build(fixture.board), BoardGateway);
		return { board, fixture, fs: yield* FileSystem.FileSystem, logs: captureLogs() };
	},
	layer: NodeServices.layer,
	name: "Board metadata warnings",
	stages: [],
	verbs: ({ board, fixture, fs, logs }, story) => ({
		createFolder: (folder: string) => {
			story.tell(`create repository folder ${folder}`);
			return fs.makeDirectory(`${fixture.root}/${folder}`, { recursive: true });
		},
		read: () => {
			story.tell("read the Board through its gateway");
			return board.get("item.0").pipe(Effect.provide(logs.layer), Effect.asVoid);
		},
		remove: (file: string) => {
			story.tell(`remove ${file}`);
			return fs.remove(`${fixture.root}/${file}`, { recursive: true });
		},
		warnings: () =>
			logs.entries
				.filter((entry) => entry.level === "Warn")
				.map((entry) => String(entry.message))
				.filter((message) => message.startsWith("Board metadata is invalid:")),
		write: (file: string, source: string) => {
			story.tell(`write Board file ${file}`);
			return fixture.write(file, source);
		},
	}),
});
