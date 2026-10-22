import { Effect } from "effect";
import { expect } from "vitest";
import { Conflict, NotFound } from "@shivaedev/platform/errors/taxonomy.ts";
import { boardHome, boardStory, projectFiles, responsesEnabled } from "#test/boardStory.ts";
import { documentSource } from "#test/documentSource.ts";
import { waitFor } from "#test/live.ts";
import { questionnaireAnswers } from "#test/questionnaire.ts";

for (const slash of ["", "/"]) {
	boardStory.it(
		`reads link targets, metadata and exact-context response records through HTTP RPC with suffix ${slash}`,
		[
			projectFiles({ "checks.md": "# Checks", "nested/reading.md": documentSource, "nested/task.md": "# Task" }),
			boardHome("checks.md"),
			responsesEnabled(),
		],
		function* ({ client, board }) {
			const result = yield* Effect.promise(() => client.run(client.api.document.run({ url: `/_board/item/investigation.choices${slash}` })));
			expect(result.source).not.toContain("::::question");
			expect(result.requests[0]?.prompts?.[0]?.source).toContain("How should replies appear?");
			expect(result.source).not.toContain("id: investigation.choices");
			expect(result.metadata.kind).toBe("task");
			expect(result.identity).toBe("investigation.choices");
			expect(result.links["task.md"]).toBe("/nested/task.md");
			expect(result.links["../shots/review.png"]).toBe("/_board/attachment/shots/review.png");
			expect(result.references["investigation.choices"]).toBe("/_board/item/investigation.choices/");
			expect(result.questionActions["direction/display"]).toBe("/_board/item/investigation.choices/#answer-card-direction");
			expect(result.questionActions["/checks"]).toBe(result.questionActions["direction/display"]);
			expect(result.requests[0]).toMatchObject({ id: "direction", open: true, preview: { context: documentSource }, responses: [] });
			const preview = result.requests[0]?.preview;
			if (!preview) {
				throw new Error("The open request has no preview");
			}
			const registered = yield* Effect.promise(() =>
				client.mutate(client.responses.registerQuestion.run({ item: preview.item, request: preview.request, revision: preview.reviewedRevision })),
			);
			yield* Effect.promise(() =>
				client.mutate(
					client.responses.recordResponse.run({
						answers: questionnaireAnswers,
						author: "reader",
						body: "Keep the full history.",
						id: "reply.reading",
						question: registered.id,
						type: "answer",
					}),
				),
			);
			yield* Effect.promise(async () =>
				waitFor(async () => {
					const fresh = await client.run(client.api.document.run({ url: "/nested/reading.md" }));
					expect(fresh.requests[0]?.responses?.[0]).toMatchObject({
						body: expect.stringContaining("Keep the full history."),
						response: { reviewedRevision: preview.reviewedRevision },
					});
				}),
			);
			expect((yield* Effect.promise(() => client.run(client.api.document.run({ url: "/" })))).file).toBe("checks.md");
			expect((yield* Effect.promise(() => fetch(`${board.url}/nested/reading.md`))).status).toBe(200);
		},
	);
}

boardStory.it(
	"refreshes query data when a referenced identity becomes ambiguous",
	[
		projectFiles({ "checks.md": "# Checks", "nested/reading.md": documentSource, "nested/task.md": "# Task" }),
		boardHome("checks.md"),
		responsesEnabled(),
	],
	function* ({ client, editFile }) {
		const atom = client.api.document.query({ url: "/nested/reading.md" });
		const release = client.registry.mount(atom);
		yield* Effect.promise(() => client.read(atom));
		editFile("duplicate.md", "---\nid: investigation.choices\n---\n# Duplicate");
		yield* Effect.promise(() =>
			waitFor(() => {
				const read = client.registry.get(atom);
				expect(read._tag === "Success" && read.value.references["investigation.choices"] === undefined).toBe(true);
			}),
		);
		const fresh = yield* Effect.promise(() => client.read(atom));
		expect(fresh.identity).toBeUndefined();
		expect(fresh.questionActions).toEqual({});
		expect(fresh.requests[0]).toMatchObject({ open: false, unavailable: expect.stringContaining("ambiguous") });
		expect(fresh.requests[0]?.responses).toBeUndefined();
		release();
	},
);

boardStory.it(
	"keeps malformed response history unavailable instead of reporting an empty history",
	[
		projectFiles({ "checks.md": "# Checks", "nested/reading.md": documentSource, "nested/task.md": "# Task" }),
		boardHome("checks.md"),
		responsesEnabled(),
	],
	function* ({ client, editFile }) {
		editFile("responses/broken.md", "---\nresponse: {}\n---\n# Damaged record");
		yield* Effect.promise(async () =>
			waitFor(async () => {
				const result = await client.run(client.api.document.run({ url: "/nested/reading.md" }));
				expect(result.requests[0]?.unavailable).toContain("malformed");
				expect(result.requests[0]?.responses).toBeUndefined();
			}),
		);
	},
);

boardStory.it(
	"rejects missing and duplicate document identities with typed read failures",
	[
		projectFiles({ "checks.md": "# Checks", "nested/reading.md": documentSource, "nested/task.md": "# Task" }),
		boardHome("checks.md"),
		responsesEnabled(),
	],
	function* ({ client, editFile }) {
		yield* Effect.promise(() => expect(client.run(client.api.document.run({ url: "/missing.md" }))).rejects.toBeInstanceOf(NotFound));
		editFile("duplicate.md", "---\nid: investigation.choices\n---\n# Duplicate");
		yield* Effect.promise(async () =>
			waitFor(async () => {
				await expect(client.run(client.api.document.run({ url: "/_board/item/investigation.choices/" }))).rejects.toBeInstanceOf(Conflict);
			}),
		);
	},
);
