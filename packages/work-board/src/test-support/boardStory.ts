import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { attentionVerbs } from "./attentionVerbs.ts";
import type { FileSystemWrapper } from "./board.ts";
import { questionnaireSource } from "./questionnaire.ts";
import { readerVerbs } from "./readerVerbs.ts";
import { responseServiceVerbs } from "./responseServiceVerbs.ts";
import { serverVerbs } from "./serverVerbs.ts";
import { connected, createBoard, inspectBoard, serveProject } from "./storyEngine.ts";
import { handoffInput, resultHtml, reviewReport, saveInboxAnswer } from "./storyResponses.ts";

export const boardStory = storyKit({
	after: { project: serveProject },
	clock: "live",
	create: createBoard,
	inspect: inspectBoard,
	name: "board",
	stages: ["project", "reader"],
	verbs: (engine, story) => ({
		...responseServiceVerbs(engine, story.tell),
		...attentionVerbs(engine, story.tell),
		...serverVerbs(engine, story.tell),
		get board() {
			return connected(engine).board;
		},
		get client() {
			return connected(engine).client;
		},
		editFile: (path: string, source: string) => {
			story.tell(`an outside editor writes ${path}`);
			engine.notes.write(path, source);
		},
		handoffDraft: () => {
			story.tell("the reader prepares handoff direction against the reviewed task");
			return handoffInput(connected(engine).client);
		},
		notes: engine.notes,
		get page() {
			return connected(engine).page;
		},
		reader: readerVerbs(engine, story.tell),
		readResult: () => {
			story.tell("the reader inspects the result, its evidence and recorded feedback");
			return resultHtml(connected(engine).board);
		},
		register: (item = "investigation.choices", request = "direction") =>
			Effect.promise(async () => {
				story.tell(`the reader registers ${item}/${request} against its reviewed source`);
				const client = connected(engine).client;
				const preview = await client.run(client.responses.question.run({ item, request }));
				return client.mutate(client.responses.registerQuestion.run({ item, request, revision: preview.reviewedRevision }));
			}),
		reviewReport: (id: string, choice: string, supersedes?: string) => {
			story.tell(`the reader records ${choice} as ${id}${supersedes ? `, superseding ${supersedes}` : ""}`);
			return reviewReport(connected(engine).client, id, choice, supersedes);
		},
		saveAnswer: () => saveInboxAnswer({ notes: engine.notes, page: connected(engine).page }, readerVerbs(engine, story.tell)),
		workspace: {
			get board() {
				return connected(engine).board;
			},
			get client() {
				return connected(engine).client;
			},
			notes: {
				...engine.notes,
				write: (path: string, source: string) => {
					story.tell(`an outside editor writes ${path}`);
					engine.notes.write(path, source);
				},
			},
			register: async () => {
				story.tell("the reader registers the questionnaire against its reviewed source");
				const client = connected(engine).client;
				const preview = await client.run(client.responses.question.run({ item: "investigation.choices", request: "direction" }));
				return client.mutate(
					client.responses.registerQuestion.run({ item: preview.item, request: preview.request, revision: preview.reviewedRevision }),
				);
			},
		},
	}),
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
	return boardStory.trait("project", `the reader starts at ${path}`, (engine) => {
		engine.path = path;
		engine.beforeScripts = beforeScripts;
	});
}

export function aQuestionnaire(source = questionnaireSource, wrap?: FileSystemWrapper) {
	return boardStory.traits(
		projectFiles({ "proposal.md": source, "task.md": "# Affected work" }, "a questionnaire asks for reading and verification choices"),
		responsesEnabled(),
		boardFilesystem(wrap),
	);
}

export function boardHome(home: string) {
	return boardStory.trait("project", home ? `the home board is ${home}` : "the workspace has no configured home board", (engine) => {
		engine.home = home;
	});
}

export function boardFilesystem(wrap?: FileSystemWrapper) {
	return boardStory.trait("project", "the workspace uses the specified filesystem boundary", (engine) => {
		const previous = engine.wrap;
		engine.wrap = (fs) => {
			const boundary = previous ? previous(fs) : fs;
			return wrap ? wrap(boundary) : boundary;
		};
	});
}
