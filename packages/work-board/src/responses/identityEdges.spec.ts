import { renameSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { responseWorkspace } from "#test/responseEdges.ts";

let workspace: Awaited<ReturnType<typeof responseWorkspace>>;
afterEach(async () => workspace?.stop());

it("rejects registration retries after the durable question file is moved", async () => {
	workspace = await responseWorkspace();
	const question = await workspace.register();
	renameSync(join(workspace.notes.root, `responses/${question.id}.md`), join(workspace.notes.root, "moved.md"));
	await expect.poll(() => workspace.client.run(workspace.client.api.navigation.run())).toContain("/moved.md");
	await expect(workspace.register()).rejects.toMatchObject({
		code: "Conflict",
		message: "The registered identity moved or is duplicated. Read the existing record instead of retrying a write.",
	});
});

it("rejects a new response identity already owned by an ordinary project item", async () => {
	workspace = await responseWorkspace();
	const question = await workspace.register();
	await expect(
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
	});
});

it("rejects response retries after the saved reply is moved by an external editor", async () => {
	workspace = await responseWorkspace();
	const question = await workspace.register();
	const input = {
		author: "reviewer",
		body: "Please clarify the intended outcome.",
		id: "response.edge",
		question: question.id,
		type: "clarify" as const,
	};
	await workspace.client.mutate(workspace.client.responses.recordResponse.run(input));
	renameSync(join(workspace.notes.root, "responses/response.edge.md"), join(workspace.notes.root, "moved.md"));
	await expect.poll(() => workspace.client.run(workspace.client.api.navigation.run())).toContain("/moved.md");
	await expect(workspace.client.mutate(workspace.client.responses.recordResponse.run(input))).rejects.toMatchObject({
		code: "Conflict",
		message: "The saved response moved. Read its existing record instead of retrying a write.",
	});
});
