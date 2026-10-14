import { readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { browserClient } from "#client/client.ts";
import { type Folder, folder, type RunningBoard, rawGet, startBoard } from "#test/board.ts";
import { questionnaireAnswers, questionnaireSource } from "#test/questionnaire.ts";
import { agentRequest } from "./agent.ts";

let notes: Folder;
let board: RunningBoard;
let client: ReturnType<typeof browserClient>;

afterEach(() => {
	client?.registry.dispose();
	notes?.remove();
});

const open = Effect.fn("Test.open")(function* () {
	notes = folder({ "proposal.md": questionnaireSource, "task.md": "# Affected work" });
	board = yield* startBoard(notes.root, undefined, (fs) => fs, true);
	client = yield* Effect.acquireRelease(
		Effect.sync(() => browserClient(board.url)),
		(value) => Effect.sync(() => value.registry.dispose()),
	);
});

const register = Effect.fn("Test.register")(function* () {
	const preview = yield* Effect.promise(() => client.run(client.responses.question.run({ item: "investigation.choices", request: "direction" })));
	return yield* Effect.promise(() =>
		client.mutate(client.responses.registerQuestion.run({ item: preview.item, request: preview.request, revision: preview.reviewedRevision })),
	);
});

it.live("delivers one validated batch through the existing wait and replays it without changing the source", function* () {
	yield* open();
	const question = yield* register();
	const input = {
		answers: questionnaireAnswers,
		author: "maintainer",
		body: "Build the grouped history next.",
		id: "response.choice",
		question: question.id,
		type: "answer" as const,
	};
	const saved = yield* Effect.promise(() => client.mutate(client.responses.recordResponse.run(input)));
	expect(saved.response.answers).toEqual(questionnaireAnswers);
	expect(saved.body).toContain("Full history");
	expect(saved.body).toContain("Selected: back, reload");
	expect(saved.body).toContain("Build the grouped history next.");
	expect(yield* Effect.promise(() => client.mutate(client.responses.recordResponse.run(input)))).toEqual(saved);
	expect(yield* agentRequest("wait", { request: question.id, url: board.url })).toMatchObject({ response: saved });
	expect(readFileSync(join(notes.root, "proposal.md"), "utf8")).toBe(questionnaireSource);
	expect(readFileSync(join(notes.root, "responses/response.choice.md"), "utf8")).toContain("answers:");
});

it.live("rejects partial, forged, duplicated and overselected answers, while allowing a text-only rejection of the framing", function* () {
	yield* open();
	const question = yield* register();
	const base = { author: "maintainer", body: "", id: "response.choice", question: question.id, type: "answer" as const };
	const activeClient = client;
	for (const answers of [
		undefined,
		questionnaireAnswers.slice(0, 1),
		[{ ...questionnaireAnswers[0], selected: ["absent"] }, questionnaireAnswers[1]],
		[{ ...questionnaireAnswers[0], selected: ["latest", "history"] }, questionnaireAnswers[1]],
		[questionnaireAnswers[0], { ...questionnaireAnswers[1], selected: ["back", "back"] }],
		[{ ...questionnaireAnswers[0], selected: [], text: "" }, questionnaireAnswers[1]],
	]) {
		yield* Effect.promise(() =>
			expect(activeClient.mutate(activeClient.responses.recordResponse.run({ ...base, ...(answers ? { answers } : {}) }))).rejects.toThrow(),
		);
	}
	const answers = questionnaireAnswers.map((answer) => ({ ...answer, selected: [], text: "None of these; revise the premise." }));
	expect((yield* Effect.promise(() => client.mutate(client.responses.recordResponse.run({ ...base, answers })))).response.answers).toEqual(answers);
});

it.live("qualifies old decisions and records explicit supersession after a move, without inheriting approval", function* () {
	yield* open();
	const old = yield* register();
	const first = yield* Effect.promise(() =>
		client.mutate(
			client.responses.recordResponse.run({
				answers: questionnaireAnswers,
				author: "maintainer",
				body: "",
				id: "response.old",
				question: old.id,
				type: "answer",
			}),
		),
	);
	renameSync(join(notes.root, "proposal.md"), join(notes.root, "moved.md"));
	yield* Effect.promise(() =>
		expect(
			client.mutate(
				client.responses.recordResponse.run({
					answers: questionnaireAnswers,
					author: "maintainer",
					body: "",
					id: "response.stale",
					question: old.id,
					type: "answer",
				}),
			),
		).rejects.toThrow("moved"),
	);
	const next = yield* register();
	const saved = yield* Effect.promise(() =>
		client.mutate(
			client.responses.recordResponse.run({
				answers: questionnaireAnswers,
				author: "maintainer",
				body: "Replaces earlier direction.",
				id: "response.new",
				question: next.id,
				supersedes: first.id,
				type: "answer",
			}),
		),
	);
	expect(saved.response.supersedes).toBe(first.id);
	const html = (yield* rawGet(board, "/_board/item/investigation.choices/")).body;
	expect(html).toContain("Earlier reviewed context — does not approve the current source");
	expect(html).toContain("Explicitly supersedes");
	expect((yield* Effect.promise(() => client.run(client.responses.responses.run({ question: old.id })))).responses).toEqual([first]);
});
