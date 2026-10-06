import { readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, expect, it } from "vitest";
import { browserClient } from "#browser/client.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { questionnaireAnswers, questionnaireSource } from "#test/questionnaire.ts";
import { agentRequest } from "./agent.ts";

let notes: Folder;
let board: RunningBoard;
let client: ReturnType<typeof browserClient>;
afterEach(async () => {
	client?.registry.dispose();
	await board?.stop();
	notes?.remove();
});
async function open() {
	notes = folder({ "proposal.md": questionnaireSource, "task.md": "# Affected work" });
	board = await startBoard(notes.root, undefined, (fs) => fs, true);
	client = browserClient(board.url);
}
async function register() {
	const preview = await client.run(client.responses.question.run({ item: "investigation.choices", request: "direction" }));
	return client.mutate(client.responses.registerQuestion.run({ item: preview.item, request: preview.request, revision: preview.reviewedRevision }));
}
it("delivers one validated batch through the existing wait and replays it without changing the source", async () => {
	await open();
	const question = await register();
	const input = {
		answers: questionnaireAnswers,
		author: "maintainer",
		body: "Build the grouped history next.",
		id: "response.choice",
		question: question.id,
		type: "answer" as const,
	};
	const saved = await client.mutate(client.responses.recordResponse.run(input));
	expect(saved.response.answers).toEqual(questionnaireAnswers);
	expect(saved.body).toContain("Full history");
	expect(saved.body).toContain("Selected: back, reload");
	expect(saved.body).toContain("Build the grouped history next.");
	expect(await client.mutate(client.responses.recordResponse.run(input))).toEqual(saved);
	expect(await Effect.runPromise(agentRequest("wait", { request: question.id, url: board.url }))).toMatchObject({ response: saved });
	expect(readFileSync(join(notes.root, "proposal.md"), "utf8")).toBe(questionnaireSource);
	expect(readFileSync(join(notes.root, "responses/response.choice.md"), "utf8")).toContain("answers:");
});
it("rejects partial, forged, duplicated and overselected answers, while allowing a text-only rejection of the framing", async () => {
	await open();
	const question = await register();
	const base = { author: "maintainer", body: "", id: "response.choice", question: question.id, type: "answer" as const };
	for (const answers of [
		undefined,
		questionnaireAnswers.slice(0, 1),
		[{ ...questionnaireAnswers[0], selected: ["absent"] }, questionnaireAnswers[1]],
		[{ ...questionnaireAnswers[0], selected: ["latest", "history"] }, questionnaireAnswers[1]],
		[questionnaireAnswers[0], { ...questionnaireAnswers[1], selected: ["back", "back"] }],
		[{ ...questionnaireAnswers[0], selected: [], text: "" }, questionnaireAnswers[1]],
	]) {
		await expect(client.mutate(client.responses.recordResponse.run({ ...base, ...(answers ? { answers } : {}) }))).rejects.toThrow();
	}
	const answers = questionnaireAnswers.map((answer) => ({ ...answer, selected: [], text: "None of these; revise the premise." }));
	expect((await client.mutate(client.responses.recordResponse.run({ ...base, answers }))).response.answers).toEqual(answers);
});
it("qualifies old decisions and records explicit supersession after a move, without inheriting approval", async () => {
	await open();
	const old = await register();
	const first = await client.mutate(
		client.responses.recordResponse.run({
			answers: questionnaireAnswers,
			author: "maintainer",
			body: "",
			id: "response.old",
			question: old.id,
			type: "answer",
		}),
	);
	renameSync(join(notes.root, "proposal.md"), join(notes.root, "moved.md"));
	await expect(
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
	).rejects.toThrow("moved");
	const next = await register();
	const saved = await client.mutate(
		client.responses.recordResponse.run({
			answers: questionnaireAnswers,
			author: "maintainer",
			body: "Replaces earlier direction.",
			id: "response.new",
			question: next.id,
			supersedes: first.id,
			type: "answer",
		}),
	);
	expect(saved.response.supersedes).toBe(first.id);
	const html = await (await fetch(`${board.url}/_board/respond?item=investigation.choices&request=direction`)).text();
	expect(html).toContain("Earlier reviewed context — does not approve the current source");
	expect(html).toContain("Explicitly supersedes");
	expect((await client.run(client.responses.responses.run({ question: old.id }))).responses).toEqual([first]);
});
