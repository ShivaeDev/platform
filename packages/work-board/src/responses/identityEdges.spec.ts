import { renameSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { responseWorkspace } from "#test/responseEdges.ts";

let workspace: Effect.Success<ReturnType<typeof responseWorkspace>>;

it.live("rejects registration retries after the durable question file is moved", function* () {
	workspace = yield* responseWorkspace();
	const question = yield* Effect.promise(() => workspace.register());
	renameSync(join(workspace.notes.root, `responses/${question.id}.md`), join(workspace.notes.root, "moved.md"));
	yield* Effect.promise(() =>
		expect
			.poll(async () => (await workspace.client.run(workspace.client.api.navigation.run({ current: "" }))).tree.files)
			.toEqual(expect.arrayContaining([expect.objectContaining({ href: "/moved.md" })])),
	);
	yield* Effect.promise(() =>
		expect(workspace.register()).rejects.toMatchObject({
			code: "Conflict",
			message: "The registered identity moved or is duplicated. Read the existing record instead of retrying a write.",
		}),
	);
});

it.live("rejects a new response identity already owned by an ordinary project item", function* () {
	workspace = yield* responseWorkspace();
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
			code: "Conflict",
			message: "This response identity is already used.",
		}),
	);
});

it.live("rejects response retries after the saved reply is moved by an external editor", function* () {
	workspace = yield* responseWorkspace();
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
		expect
			.poll(async () => (await workspace.client.run(workspace.client.api.navigation.run({ current: "" }))).tree.files)
			.toEqual(expect.arrayContaining([expect.objectContaining({ href: "/moved.md" })])),
	);
	yield* Effect.promise(() =>
		expect(workspace.client.mutate(workspace.client.responses.recordResponse.run(input))).rejects.toMatchObject({
			code: "Conflict",
			message: "The saved response moved. Read its existing record instead of retrying a write.",
		}),
	);
});
