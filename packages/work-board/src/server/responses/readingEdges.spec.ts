import { chmodSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { expect } from "vitest";
import { questionMarkdown, responseMarkdown } from "#server/responses/records.ts";
import { aQuestionnaire, boardStory } from "#test/boardStory.ts";
import { questionnaireSource } from "#test/questionnaire.ts";
import { largeQuestion, recordedEdgeResponse } from "#test/responseEdges.ts";

boardStory.it("rejects absent attention requests with an exact missing-request error", [aQuestionnaire()], function* ({ workspace }) {
	yield* Effect.promise(() =>
		expect(workspace.client.run(workspace.client.responses.question.run({ item: "investigation.choices", request: "absent" }))).rejects.toMatchObject(
			{
				_tag: "NotFound",
				message: "The exact open attention request is missing, ambiguous or unavailable.",
			},
		),
	);
});

boardStory.it(
	"bounds the UTF-8 source context before registering a question",
	[aQuestionnaire(`${questionnaireSource}\n${"💬".repeat((256 * 1024) / 4)}`)],
	function* ({ workspace }) {
		yield* Effect.promise(() =>
			expect(workspace.register()).rejects.toMatchObject({
				_tag: "BadRequest",
				message: "Question context is limited to 256 KiB; use a focused source document.",
			}),
		);
	},
);

boardStory.it(
	"returns the template diagnostic when an authored packet has an empty option",
	[aQuestionnaire(questionnaireSource.replace("**Latest reply** — compact, with older replies behind a link.", ""))],
	function* ({ workspace }) {
		yield* Effect.promise(() =>
			expect(workspace.register()).rejects.toMatchObject({
				_tag: "BadRequest",
				message: "Invalid response template: Options need Markdown descriptions and cannot nest response controls.",
			}),
		);
	},
);

boardStory.it("rejects a project item passed as a registered-question identity", [aQuestionnaire()], function* ({ workspace }) {
	yield* Effect.promise(() =>
		expect(workspace.client.run(workspace.client.responses.responses.run({ question: "investigation.choices" }))).rejects.toMatchObject({
			_tag: "Conflict",
			message: "This identity is not a valid registered question; response history is unknown.",
		}),
	);
});

boardStory.it("rejects a next-response cursor absent from durable history", [aQuestionnaire()], function* ({ workspace }) {
	const question = yield* Effect.promise(() => workspace.register());
	yield* Effect.promise(() =>
		expect(
			workspace.client.run(workspace.client.responses.awaitResponse.run({ after: "response.absent", question: question.id })),
		).rejects.toMatchObject({
			_tag: "NotFound",
			message: "The next-response cursor is not recorded for this question.",
		}),
	);
});

boardStory.it("rejects an oversized registered question added by an external file writer", [aQuestionnaire()], function* ({ workspace, editFile }) {
	const question = largeQuestion(yield* Effect.promise(() => workspace.register()));
	editFile(`responses/${question.id}.md`, questionMarkdown(question));
	yield* Effect.promise(() =>
		expect
			// Reading the oversized question can take a second on a busy runner, which alone exhausts the default poll timeout.
			.poll(() => workspace.client.run(workspace.client.responses.responses.run({ question: question.id })).then(() => "readable", String), {
				timeout: 10_000,
			})
			.toContain("The registered context exceeds the 256 KiB limit."),
	);
});

boardStory.it("rejects an oversized recorded reply added by an external file writer", [aQuestionnaire()], function* ({ workspace, editFile }) {
	const question = yield* Effect.promise(() => workspace.register());
	editFile("responses/response.edge.md", responseMarkdown(recordedEdgeResponse(question, "x".repeat(32_769))));
	yield* Effect.promise(() =>
		expect
			.poll(() => workspace.client.run(workspace.client.responses.responses.run({ question: question.id })).then(() => "readable", String))
			.toContain("A recorded response exceeds the supported text limit; read its source file directly."),
	);
});

boardStory.it(
	"does not choose a reply when an external file writer duplicates its identity",
	[aQuestionnaire()],
	function* ({ workspace, editFile }) {
		const question = yield* Effect.promise(() => workspace.register());
		const source = responseMarkdown(recordedEdgeResponse(question));
		editFile("responses/response.edge.md", source);
		editFile("duplicate.md", source);
		yield* Effect.promise(() =>
			expect
				.poll(() => workspace.client.run(workspace.client.responses.responses.run({ question: question.id })).then(() => "readable", String))
				.toContain("A response identity is duplicated; no answer is selected."),
		);
	},
);

boardStory.it("refuses to select responses when a real workspace file becomes unreadable", [aQuestionnaire()], function* ({ workspace }) {
	const question = yield* Effect.promise(() => workspace.register());
	chmodSync(join(workspace.notes.root, "task.md"), 0o000);
	try {
		yield* Effect.promise(() =>
			expect
				.poll(() =>
					workspace.client.run(workspace.client.responses.responses.run({ question: question.id })).then(
						(reading) => reading,
						(error: unknown) => error,
					),
				)
				.toMatchObject({
					_tag: "ServiceUnavailable",
					message: "The workspace index is incomplete; no response can be selected safely.",
				}),
		);
	} finally {
		chmodSync(join(workspace.notes.root, "task.md"), 0o644);
	}
});

boardStory.it(
	"orders independently written equal-time replies by identity and advances the durable cursor deterministically",
	[aQuestionnaire()],
	function* ({ workspace, editFile }) {
		const question = yield* Effect.promise(() => workspace.register());
		const later = { ...recordedEdgeResponse(question), id: "response.z" };
		const earlier = { ...recordedEdgeResponse(question), id: "response.a" };
		editFile("responses/first.md", responseMarkdown(later));
		editFile("responses/second.md", responseMarkdown(earlier));
		yield* Effect.promise(() =>
			expect
				.poll(() => workspace.client.run(workspace.client.responses.responses.run({ question: question.id })))
				.toMatchObject({ responses: [earlier, later] }),
		);
		expect(
			(yield* Effect.promise(() => workspace.client.run(workspace.client.responses.awaitResponse.run({ question: question.id })))).response,
		).toEqual(earlier);
		expect(
			(yield* Effect.promise(() => workspace.client.run(workspace.client.responses.awaitResponse.run({ after: earlier.id, question: question.id }))))
				.response,
		).toEqual(later);
	},
);
