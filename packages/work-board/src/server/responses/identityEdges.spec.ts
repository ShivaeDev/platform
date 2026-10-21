import { renameSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { expect } from "vitest";
import { aQuestionnaire, boardStory } from "#test/boardStory.ts";

boardStory.it("rejects registration retries after the durable question file is moved", [aQuestionnaire()], function* ({ workspace }) {
	const question = yield* Effect.promise(() => workspace.register());
	renameSync(join(workspace.notes.root, `responses/${question.id}.md`), join(workspace.notes.root, "moved.md"));
	yield* Effect.promise(() =>
		expect.poll(async () => (await workspace.client.run(workspace.client.api.document.run({ url: "/moved.md" }))).metadata.id).toBe(question.id),
	);
	yield* Effect.promise(() =>
		expect(workspace.register()).rejects.toMatchObject({
			_tag: "Conflict",
			message: "The registered identity moved or is duplicated. Read the existing record instead of retrying a write.",
		}),
	);
});

boardStory.it("rejects a new response identity already owned by an ordinary project item", [aQuestionnaire()], function* ({ workspace }) {
	const question = yield* Effect.promise(() => workspace.register());
	yield* Effect.promise(() =>
		expect(
			workspace.client.mutate(
				workspace.client.responses.recordResponse.run({
					author: "reviewer",
					body: "Please clarify the intended outcome.",
					id: "investigation.choices",
					question: question.id,
					type: "clarify",
				}),
			),
		).rejects.toMatchObject({
			_tag: "Conflict",
			message: "This response identity is already used.",
		}),
	);
});

boardStory.it("rejects response retries after the saved reply is moved by an external editor", [aQuestionnaire()], function* ({ workspace }) {
	const question = yield* Effect.promise(() => workspace.register());
	const input = {
		author: "reviewer",
		body: "Please clarify the intended outcome.",
		id: "response.edge",
		question: question.id,
		type: "clarify" as const,
	};
	yield* Effect.promise(() => workspace.client.mutate(workspace.client.responses.recordResponse.run(input)));
	renameSync(join(workspace.notes.root, "responses/response.edge.md"), join(workspace.notes.root, "moved.md"));
	yield* Effect.promise(() =>
		expect.poll(async () => (await workspace.client.run(workspace.client.api.document.run({ url: "/moved.md" }))).metadata.id).toBe("response.edge"),
	);
	yield* Effect.promise(() =>
		expect(workspace.client.mutate(workspace.client.responses.recordResponse.run(input))).rejects.toMatchObject({
			_tag: "Conflict",
			message: "The saved response moved. Read its existing record instead of retrying a write.",
		}),
	);
});
