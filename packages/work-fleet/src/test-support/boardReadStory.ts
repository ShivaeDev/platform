import { queryObjects } from "node:v8";
import { NodeServices } from "@effect/platform-node";
import { Context, Effect, FileSystem, Layer } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { BoardSnapshot, publishAfterBoardPass } from "#board/readPass.ts";
import { workRevision } from "#board/workRevision.ts";
import { writeStatus } from "#board/writeStatus.ts";
import { BoardGateway } from "#policy.ts";
import { boardReads } from "#test/boardReads.ts";
import { statusRecord } from "#test/status.ts";

export const boardReadStory = storyKit({
	clock: "live",
	*create() {
		const fixture = yield* boardReads(0);
		const board = Context.get(yield* Layer.build(fixture.board), BoardGateway);
		return { board, fixture, fs: yield* FileSystem.FileSystem, publications: 0 };
	},
	layer: NodeServices.layer,
	name: "Board folder reads",
	stages: ["files"],
	verbs: (state, story) => {
		const { fixture, board, fs } = state;
		const publish = writeStatus(fixture.root, fixture.root, [statusRecord("item.0")]).pipe(
			Effect.orDie,
			Effect.tap(() =>
				Effect.sync(() => {
					state.publications += 1;
				}),
			),
		);
		return {
			board: {
				...board,
				decision: (...args: Parameters<typeof board.decision>) => {
					story.tell(`publish decision for ${args[0]}`);
					return board.decision(...args);
				},
				get: (...args: Parameters<typeof board.get>) => {
					story.tell(`read Board work ${args[0]}`);
					return board.get(...args);
				},
				readDecision: (...args: Parameters<typeof board.readDecision>) => {
					story.tell(`read decision ${args[0].questionId}`);
					return board.readDecision(...args);
				},
				report: (...args: Parameters<typeof board.report>) => {
					story.tell(`publish report for ${args[0].workId}`);
					return board.report(...args);
				},
			},
			deferStatus: () => {
				story.tell("defer the generated status publication");
				return publishAfterBoardPass(publish);
			},
			fixture: {
				...fixture,
				pauseReads: () => {
					story.tell("pause document reads after capturing their source");
					return fixture.pauseReads;
				},
				remove: (file: string) => {
					story.tell(`remove Board file ${file}`);
					return fixture.remove(file);
				},
				write: (file: string, content: string) => {
					story.tell(`write Board file ${file}`);
					return fixture.write(file, content);
				},
			},
			publicationCount: () => state.publications,
			publishedStatus: () =>
				Effect.gen(function* () {
					const path = `${fixture.root}/fleet/status.md`;
					return (yield* fs.exists(path)) ? yield* fs.readFileString(path) : undefined;
				}),
			savedRevision: (revision: string, context?: string) => workRevision(revision, context),
		};
	},
});

export function hasBoardItems(count: number) {
	return boardReadStory.trait("files", `the Board folder contains ${count} approved items`, function* ({ fixture }) {
		for (let index = 0; index < count; index += 1) {
			yield* fixture.write(`${index}.md`, fixture.source(`item.${index}`));
		}
	});
}

export const retainedBoardSnapshots = Effect.promise(() => new Promise<void>((resolve) => setImmediate(resolve))).pipe(
	Effect.andThen(Effect.sync(() => queryObjects(BoardSnapshot, { format: "count" }))),
);
