import { readdirSync } from "node:fs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { metadataModel } from "#metadata/model.ts";
import { metadataParse } from "#metadata/parse.ts";
import { escapeHtml } from "#page/escape.ts";
import { startTemplates } from "#page/startTemplates.ts";
import { folder, type RunningBoard, rawGet, startBoard } from "#test/board.ts";

let notes: ReturnType<typeof folder>;
let board: RunningBoard;
beforeEach(async () => {
	notes = folder({});
	board = await startBoard(notes.root);
});
afterEach(async () => {
	await board.stop();
	notes.remove();
});

it("serves copyable source on an empty root without creating files or hiding missing-document errors", async () => {
	const response = await fetch(board.url);
	expect(response.status).toBe(200);
	const html = await response.text();
	expect(html).toContain("Start your local workspace");
	expect(html).toContain("this viewer does not write project files");
	for (const template of startTemplates) {
		expect(html).toContain(`readonly rows="16" spellcheck="false">${escapeHtml(template.source)}</textarea>`);
	}

	expect(readdirSync(notes.root)).toEqual([]);
	expect((await fetch(`${board.url}/missing.md`)).status).toBe(404);
	expect((await rawGet(board, "/_board/start", "outside.example")).status).toBe(403);
});

it("keeps templates available after source creation and resolves their relationships without fabricated evidence", async () => {
	const documents = startTemplates.map((template) => ({ file: template.file, parsed: metadataParse(template.source) }));
	for (const document of documents) {
		expect(document.parsed.diagnostics).toEqual([]);
	}
	const model = metadataModel(documents, []);
	expect([...model.diagnostics.values()].flat()).toEqual([]);
	expect(documents.find((document) => document.file === "result.md")?.parsed.fields.evidence).toBeUndefined();
	for (const template of startTemplates) {
		notes.write(template.file, template.source);
	}
	await vi.waitFor(async () => {
		const response = await fetch(`${board.url}/result.md`);
		expect(response.status).toBe(200);
	});
	const result = await (await fetch(`${board.url}/result.md`)).text();
	expect(result).toContain('href="/investigation.md"');
	expect(result).toContain('href="/project.md"');
	expect(result).toContain("Not recorded.");
	expect(result).toContain("Recorded evidence does not by itself establish verified acceptance.");
	const help = await (await fetch(`${board.url}/_board/start`)).text();
	expect(help).toContain("Project and report templates");
	expect(await (await fetch(board.url)).text()).not.toContain("Start your local workspace");
	expect(readdirSync(notes.root).sort()).toEqual(startTemplates.map((template) => template.file).sort());
});
