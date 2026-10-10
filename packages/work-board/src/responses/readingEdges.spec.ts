import { chmodSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { questionMarkdown, responseMarkdown } from "#responses/records.ts";
import { questionnaireSource } from "#test/questionnaire.ts";
import { largeQuestion, recordedEdgeResponse, responseWorkspace } from "#test/responseEdges.ts";

let workspace: Awaited<ReturnType<typeof responseWorkspace>>;
afterEach(async () => workspace?.stop());

it("rejects absent attention requests with an exact missing-request error", async () => {
	workspace = await responseWorkspace();
	await expect(
		workspace.client.run(workspace.client.responses.question.run({ item: "investigation.choices", request: "absent" })),
	).rejects.toMatchObject({
		code: "Missing",
		message: "The exact open attention request is missing, ambiguous or unavailable.",
	});
});

it("bounds the UTF-8 source context before registering a question", async () => {
	workspace = await responseWorkspace(`${questionnaireSource}\n${"💬".repeat((256 * 1024) / 4)}`);
	await expect(workspace.register()).rejects.toMatchObject({
		code: "Unsupported",
		message: "Question context is limited to 256 KiB; use a focused source document.",
	});
});

it("returns the template diagnostic when an authored packet has an empty option", async () => {
	workspace = await responseWorkspace(questionnaireSource.replace("**Latest reply** — compact, with older replies behind a link.", ""));
	await expect(workspace.register()).rejects.toMatchObject({
		code: "Unsupported",
		message: "Invalid response template: Error: Options need Markdown descriptions and cannot nest response controls.",
	});
});

it("rejects a project item passed as a registered-question identity", async () => {
	workspace = await responseWorkspace();
	await expect(workspace.client.run(workspace.client.responses.responses.run({ question: "investigation.choices" }))).rejects.toMatchObject({
		code: "Conflict",
		message: "This identity is not a valid registered question; response history is unknown.",
	});
});

it("rejects a next-response cursor absent from durable history", async () => {
	workspace = await responseWorkspace();
	const question = await workspace.register();
	await expect(
		workspace.client.run(workspace.client.responses.awaitResponse.run({ after: "response.absent", question: question.id })),
	).rejects.toMatchObject({
		code: "Missing",
		message: "The next-response cursor is not recorded for this question.",
	});
});

it("rejects an oversized registered question added by an external file writer", async () => {
	workspace = await responseWorkspace();
	const question = largeQuestion(await workspace.register());
	workspace.notes.write(`responses/${question.id}.md`, questionMarkdown(question));
	await expect
		.poll(() => workspace.client.run(workspace.client.responses.responses.run({ question: question.id })).then(() => "readable", String))
		.toContain("The registered context exceeds the 256 KiB limit.");
});

it("rejects an oversized recorded reply added by an external file writer", async () => {
	workspace = await responseWorkspace();
	const question = await workspace.register();
	workspace.notes.write("responses/response.edge.md", responseMarkdown(recordedEdgeResponse(question, "x".repeat(32_769))));
	await expect
		.poll(() => workspace.client.run(workspace.client.responses.responses.run({ question: question.id })).then(() => "readable", String))
		.toContain("A recorded response exceeds the supported text limit; read its source file directly.");
});

it("does not choose a reply when an external file writer duplicates its identity", async () => {
	workspace = await responseWorkspace();
	const question = await workspace.register();
	const source = responseMarkdown(recordedEdgeResponse(question));
	workspace.notes.write("responses/response.edge.md", source);
	workspace.notes.write("duplicate.md", source);
	await expect
		.poll(() => workspace.client.run(workspace.client.responses.responses.run({ question: question.id })).then(() => "readable", String))
		.toContain("A response identity is duplicated; no answer is selected.");
});

it("refuses to select responses when a real workspace file becomes unreadable", async () => {
	workspace = await responseWorkspace();
	const question = await workspace.register();
	chmodSync(join(workspace.notes.root, "task.md"), 0o000);
	try {
		await expect
			.poll(() =>
				workspace.client.run(workspace.client.responses.responses.run({ question: question.id })).then(
					(reading) => reading,
					(error: unknown) => error,
				),
			)
			.toMatchObject({
				code: "Unavailable",
				message: "The workspace index is incomplete; no response can be selected safely.",
			});
	} finally {
		chmodSync(join(workspace.notes.root, "task.md"), 0o644);
	}
});

it("orders independently written equal-time replies by identity and advances the durable cursor deterministically", async () => {
	workspace = await responseWorkspace();
	const question = await workspace.register();
	const later = { ...recordedEdgeResponse(question), id: "response.z" };
	const earlier = { ...recordedEdgeResponse(question), id: "response.a" };
	workspace.notes.write("responses/first.md", responseMarkdown(later));
	workspace.notes.write("responses/second.md", responseMarkdown(earlier));
	await expect
		.poll(() => workspace.client.run(workspace.client.responses.responses.run({ question: question.id })))
		.toMatchObject({ responses: [earlier, later] });
	expect((await workspace.client.run(workspace.client.responses.awaitResponse.run({ question: question.id }))).response).toEqual(earlier);
	expect((await workspace.client.run(workspace.client.responses.awaitResponse.run({ after: earlier.id, question: question.id }))).response).toEqual(
		later,
	);
});
