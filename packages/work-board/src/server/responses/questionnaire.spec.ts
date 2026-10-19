import { readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { expect } from "vitest";
import { aQuestionnaire, boardStory, responsesEnabled } from "#test/boardStory.ts";
import { waitFor } from "#test/live.ts";
import { questionnaireAnswers, questionnaireSource } from "#test/questionnaire.ts";
import { agentRequest } from "./agent.ts";

boardStory.it(
	"delivers one validated batch through the existing wait and replays it without changing the source",
	[aQuestionnaire(), responsesEnabled()],
	function* ({ notes, board, client, register }) {
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
	},
);

boardStory.it(
	"rejects partial, forged, duplicated and overselected answers, while allowing a text-only rejection of the framing",
	[aQuestionnaire(), responsesEnabled()],
	function* ({ client, register }) {
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
	},
);

boardStory.it(
	"qualifies old decisions and records explicit supersession after a move, without inheriting approval",
	[aQuestionnaire(), responsesEnabled()],
	function* ({ notes, client, register }) {
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
		yield* Effect.promise(() =>
			waitFor(() => expect(client.run(client.api.document.run({ url: "/moved.md" }))).resolves.toMatchObject({ file: "moved.md" })),
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
		expect((yield* Effect.promise(() => client.run(client.responses.responses.run({ question: old.id })))).responses).toEqual([first]);
	},
);
