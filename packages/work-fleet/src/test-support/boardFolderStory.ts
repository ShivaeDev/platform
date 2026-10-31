import { NodeServices } from "@effect/platform-node";
import { Context, Effect, Layer } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { migrate } from "@shivaedev/work-board/server/migration/migrate.ts";
import { markdownBoard } from "#board/markdown.ts";
import { BoardGateway } from "#policy.ts";
import { boardAnswerVerbs } from "#test/boardAnswerVerbs.ts";
import { boardDecisionVerbs } from "#test/boardDecisionVerbs.ts";
import { boardFolder } from "#test/boardFolder.ts";
import { boardAskFiles, boardHttp, boardHttpFiles } from "#test/boardHttp.ts";
import { captureLogs } from "#test/captureLogs.ts";

interface FolderState {
	board: typeof BoardGateway.Service | undefined;
	kind: Parameters<typeof boardFolder>[0] | undefined;
	root: string;
}
export const boardFolderStory = storyKit({
	after: {
		*files(state) {
			if (state.kind === undefined) {
				return yield* Effect.die("The story must name its Board folder contents");
			}
			state.root = yield* boardFolder(state.kind);
			state.board = Context.get(yield* Layer.build(markdownBoard(state.root)), BoardGateway);
		},
	},
	clock: "live",
	create: (): FolderState => ({ board: undefined, kind: undefined, root: "" }),
	layer: NodeServices.layer,
	name: "Board folder decisions",
	stages: ["files"],
	verbs: (state, story) => {
		if (state.board === undefined) {
			throw new Error("The Board folder did not open");
		}
		let board = state.board;
		const logs = captureLogs();
		const files = boardHttpFiles(state.root);
		return {
			...boardAnswerVerbs(state.root, story.tell),
			...boardDecisionVerbs(state.root, () => board, files, story.tell),
			askFiles: (maintainer?: string) => {
				story.tell("read the Board inbox over HTTP");
				return boardAskFiles(state.root, maintainer);
			},
			board,
			files: {
				...files,
				move: (from: string, to: string) => {
					story.tell(`move ${from} to ${to}`);
					files.move(from, to);
				},
				write: (file: string, content: string) => {
					story.tell(`write ${file}`);
					files.write(file, content);
				},
			},
			migrate: () => {
				story.tell("migrate the Board folder vocabulary");
				return migrate(state.root);
			},
			openHttp: (...args: [home?: string, maintainer?: string, fleetPort?: number]) => {
				story.tell("open a Board HTTP reader");
				return boardHttp(state.root, ...args);
			},
			readBrief: (id: string) => {
				story.tell(`Fleet reads the Board brief ${id}`);
				return board.get(id).pipe(Effect.provide(logs.layer));
			},
			recordedBoardWarnings: () => Effect.sync(() => logs.entries.map(({ message }) => JSON.stringify(message))),
			reopenBoard: () => {
				story.tell("reopen the Board folder");
				return Layer.build(Layer.fresh(markdownBoard(state.root))).pipe(
					Effect.tap((services) =>
						Effect.sync(() => {
							board = Context.get(services, BoardGateway);
						}),
					),
					Effect.asVoid,
				);
			},
			root: state.root,
			sourceOf: (file: string) => Effect.sync(() => files.read(file)),
		};
	},
});
export function folderContains(kind: Parameters<typeof boardFolder>[0]) {
	return boardFolderStory.trait("files", `the Board folder has ${kind}`, (state) => {
		state.kind = kind;
	});
}
