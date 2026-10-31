import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { answersBoardVerbs } from "#test/answersBoardVerbs.ts";
import { archiveVerbs } from "#test/archiveVerbs.ts";
import type { FileSystemWrapper } from "#test/board.ts";
import { held } from "#test/browser.ts";
import { distinctVerbs } from "#test/distinctVerbs.ts";
import { fileVerbs } from "#test/fileVerbs.ts";
import { liveBoardVerbs } from "#test/liveBoardVerbs.ts";
import { livePageVerbs } from "#test/livePageVerbs.ts";
import { metadataScreen } from "#test/metadataScreen.tsx";
import { migrationVerbs } from "#test/migrationVerbs.ts";
import { nativeVerbs } from "#test/nativeVerbs.ts";
import { pagesBoardVerbs } from "#test/pagesBoardVerbs.ts";
import { questionnaireSource } from "#test/questionnaire.ts";
import { readerVerbs } from "#test/readerVerbs.ts";
import { readingBoardVerbs } from "#test/readingBoardVerbs.ts";
import { readingVerbs } from "#test/readingVerbs.ts";
import { readVerbs } from "#test/readVerbs.ts";
import { responseFeedVerbs } from "#test/responseFeedVerbs.ts";
import { responseServiceVerbs } from "#test/responseServiceVerbs.ts";
import { responsesBoardVerbs } from "#test/responsesBoardVerbs.ts";
import { serverVerbs } from "#test/serverVerbs.ts";
import { servingBoardVerbs } from "#test/servingBoardVerbs.ts";
import { servingVerbs } from "#test/servingVerbs.ts";
import { servingWatchVerbs } from "#test/servingWatchVerbs.ts";
import { shellBoardVerbs } from "#test/shellBoardVerbs.ts";
import { socketVerbs } from "#test/socketVerbs.ts";
import { standingQuestionVerbs } from "#test/standingQuestionVerbs.ts";
import { connected, createBoard, inspectBoard, openReader, served, serveProject, wrapFilesystem } from "#test/storyEngine.ts";
import { handoffInput, resultHtml, reviewReport, savedInboxAnswer } from "#test/storyResponses.ts";
import { workspaceAccess } from "#test/workspaceAccess.ts";
import { workspaceBoardVerbs } from "#test/workspaceBoardVerbs.ts";
import { workspaceItemVerbs } from "#test/workspaceItemVerbs.ts";
import { workspacePageVerbs } from "#test/workspacePageVerbs.ts";

export const boardStory = storyKit({
	after: { project: serveProject },
	clock: "live",
	create: createBoard,
	inspect: inspectBoard,
	name: "board",
	stages: ["project", "reader"],
	verbs: (engine, story) =>
		distinctVerbs(
			archiveVerbs(engine, story.tell),
			readingVerbs(engine, story.tell),
			migrationVerbs(engine, story.tell),
			responseServiceVerbs(engine, story.tell),
			responseFeedVerbs(engine, story.tell),
			standingQuestionVerbs(engine, story.tell),
			serverVerbs(engine, story.tell),
			socketVerbs(engine, story.tell),
			servingVerbs(engine, story.tell),
			nativeVerbs(engine, story.tell),
			fileVerbs(engine, story.tell),
			livePageVerbs(engine, story.tell),
			readVerbs(engine, story.tell),
			answersBoardVerbs(engine, story.tell),
			pagesBoardVerbs(engine, story.tell),
			readingBoardVerbs(engine, story.tell),
			shellBoardVerbs(engine, story.tell),
			responsesBoardVerbs(engine, story.tell),
			servingBoardVerbs(engine, story.tell),
			servingWatchVerbs(engine, story.tell),
			liveBoardVerbs(engine, story.tell),
			workspaceBoardVerbs(engine, story.tell),
			workspaceItemVerbs(engine, story.tell),
			workspacePageVerbs(engine, story.tell),
			{
				get board() {
					return served(engine).board;
				},
				get client() {
					return served(engine).client;
				},
				editFile: (path: string, source: string) => {
					story.tell(`an outside editor writes ${path}`);
					engine.notes.write(path, source);
				},
				handoffDraft: () => {
					story.tell("the reader prepares handoff direction against the reviewed task");
					return handoffInput(served(engine).client);
				},
				get linked() {
					if (!engine.linked) {
						throw new Error("No linked project was prepared");
					}
					return engine.linked;
				},
				notes: engine.notes,
				openMetadata: (file: string) => {
					story.tell(`the reader opens source diagnostics for ${file}`);
					return metadataScreen(engine, file);
				},
				get outside() {
					if (!engine.outside) {
						throw new Error("No outside folder was prepared");
					}
					return engine.outside;
				},
				get page() {
					return connected(engine).page;
				},
				reader: readerVerbs(engine, story.tell),
				readResult: () => {
					story.tell("the reader inspects the result, its evidence and recorded feedback");
					return resultHtml(served(engine).board);
				},
				register: (item = "investigation.choices", request = "direction") =>
					Effect.promise(async () => {
						story.tell(`the reader registers ${item}/${request} against its reviewed source`);
						const client = served(engine).client;
						const preview = await client.run(client.responses.question.run({ item, request }));
						return client.mutate(client.responses.registerQuestion.run({ item, request, revision: preview.reviewedRevision }));
					}),
				reviewReport: (id: string, choice: string, supersedes?: string) => {
					story.tell(`the reader records ${choice} as ${id}${supersedes ? `, superseding ${supersedes}` : ""}`);
					return reviewReport(served(engine).client, id, choice, supersedes);
				},
				savedAnswer: () => {
					story.tell("the reader reads the recorded answer file");
					return savedInboxAnswer(engine.notes);
				},
				workspace: workspaceAccess(engine, story.tell),
			},
		),
});

export function projectFiles(files: Readonly<Record<string, string>>, line = "the project contains these Markdown files") {
	return boardStory.trait("project", `${line}: ${Object.keys(files).join(", ")}`, (engine) => {
		for (const [path, source] of Object.entries(files)) {
			engine.notes.write(path, source);
		}
	});
}

export function responsesEnabled(enabled = true) {
	return boardStory.trait("project", enabled ? "responses are enabled" : "responses are read-only", (engine) => {
		engine.responses = enabled;
	});
}

export function readerAt(path: string, beforeScripts?: Parameters<typeof import("./browser.ts").openPage>[2]) {
	return boardStory.trait("reader", `the reader starts at ${path}`, function* (engine) {
		engine.path = path;
		engine.beforeScripts = beforeScripts ?? engine.beforeScripts;
		yield* openReader(engine);
	});
}

export function readerArrivesEarly(path: string) {
	return boardStory.trait("reader", `the reader opens ${path} before the board can show it`, function* (engine) {
		engine.path = path;
		yield* openReader(engine, false);
	});
}

export function aQuestionnaire(source = questionnaireSource, wrap?: FileSystemWrapper) {
	return boardStory.traits(
		projectFiles({ "proposal.md": source, "task.md": "# Affected work" }, "a questionnaire asks for reading and verification choices"),
		responsesEnabled(),
		...(wrap ? [boardFilesystem(wrap)] : []),
	);
}

export function boardHome(home: string) {
	return boardStory.trait("project", home ? `the home board is ${home}` : "the workspace has no configured home board", (engine) => {
		engine.home = home || undefined;
	});
}

export function boardFilesystem(wrap: FileSystemWrapper) {
	return boardStory.trait("project", "the workspace uses the specified filesystem boundary", (engine) => {
		wrapFilesystem(engine, wrap);
	});
}

export function heldRequest(method: string) {
	return boardStory.trait("project", `the page holds its ${method} requests until released`, (engine) => {
		engine.heldRequests ??= new Map();
		engine.heldRequests.set(method, held());
	});
}

export const deferredServing = boardStory.trait("project", "the board waits for an explicit startup", (engine) => {
	engine.manualServing = true;
});
