import { existsSync } from "node:fs";
import { Effect, Exit, Scope } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { inboxQuestion } from "./inboxFixture.ts";
import { type BoardEngine, connected, createBoard, inspectBoard, openReader, serveProject } from "./storyEngine.ts";

interface InnerStory {
	board?: BoardEngine;
	scope?: Scope.Closeable;
}

function inner(engine: InnerStory) {
	if (!(engine.board && engine.scope)) {
		throw new Error("Add the questionBoardOpen trait before reading the inner story");
	}
	return { board: engine.board, scope: engine.scope };
}

export const storyEngineStory = storyKit({
	clock: "live",
	create: (): InnerStory => ({}),
	name: "board lifecycle",
	stages: ["story"],
	verbs: (engine, story) => ({
		boardAnswers: () => {
			story.tell("a local client asks the inner story's board for its home page");
			return Effect.promise(() =>
				fetch(connected(inner(engine).board).board.url).then(
					() => "answers",
					() => "unreachable",
				),
			);
		},
		failStory: () => {
			story.tell("the inner story's assertion fails and its scope closes");
			return Scope.close(inner(engine).scope, Exit.fail("the reader's assertion failed"));
		},
		pageBody: () =>
			Effect.sync(() => {
				story.tell("the reader reads the inner story's bundle page");
				return connected(inner(engine).board).page.document.body.textContent || "empty";
			}),
		projectFolder: () =>
			Effect.sync(() => {
				story.tell("the reader looks for the inner story's project folder");
				return existsSync(inner(engine).board.notes.root) ? "present" : "removed";
			}),
		retainedView: () =>
			Effect.sync(() => {
				story.tell("the reader reads the view the inner story kept");
				const { inbox, text } = inspectBoard(inner(engine).board);
				return { inbox, text };
			}),
	}),
});

export function questionBoardOpen() {
	return storyEngineStory.trait(
		"story",
		"an inner board story serves an open storage question and the reader opens it in the bundle page",
		function* (engine: InnerStory) {
			const scope = yield* Scope.make();
			engine.scope = scope;
			const board = yield* Effect.gen(createBoard).pipe(Scope.provide(scope));
			engine.board = board;
			board.notes.write("question.md", inboxQuestion);
			board.path = "/_board/item/question.storage/";
			yield* Effect.gen(() => serveProject(board)).pipe(Scope.provide(scope));
			yield* Effect.gen(() => openReader(board)).pipe(Scope.provide(scope));
		},
	);
}
