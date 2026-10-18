import { readdirSync } from "node:fs";
import { Effect, Layer } from "effect";
import { afterEach, expect } from "vitest";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { escapeHtml } from "#browser/escapeHtml.ts";
import { metadataModel } from "#server/metadata/model.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import { startTemplates } from "#server/page/startTemplates.ts";
import { folder, type RunningBoard, rawGet, startBoard } from "#test/board.ts";
import { waitFor } from "#test/live.ts";
import { renderRemaining } from "#test/renderRemaining.tsx";

let notes: ReturnType<typeof folder>;
let board: RunningBoard;

const setupBoard = Effect.gen(function* () {
	notes = folder({});
	board = yield* startBoard(notes.root);
});

const { effectApp } = makeEffectIt({ clock: "live", layer: Layer.empty, makeHarness: () => setupBoard });

afterEach(() => {
	notes.remove();
});

effectApp("serves copyable source on an empty root without creating project files or hiding missing-document errors", function* () {
	const response = yield* Effect.promise(() => fetch(board.url));
	expect(response.status).toBe(200);
	const html = yield* Effect.promise(() => renderRemaining(board.url, "/_board/start"));
	expect(html).toContain("Start your local workspace");
	expect(html).toContain("this viewer does not write project files");
	for (const template of startTemplates) {
		expect(html).toContain(`>${escapeHtml(template.source)}</textarea>`);
	}
	expect(readdirSync(notes.root)).toEqual(["board.sock"]);
	expect((yield* Effect.promise(() => fetch(`${board.url}/missing.md`))).status).toBe(404);
	expect((yield* rawGet(board, "/_board/start", "outside.example")).status).toBe(403);
});

effectApp("keeps templates available after source creation and resolves their relationships without fabricated evidence", function* () {
	const documents = startTemplates.map((template) => ({ file: template.file, parsed: metadataParse(template.source) }));
	for (const entry of documents) {
		expect(entry.parsed.diagnostics).toEqual([]);
	}
	const model = metadataModel(documents, []);
	expect([...model.diagnostics.values()].flat()).toEqual([]);
	expect(documents.find((entry) => entry.file === "result.md")?.parsed.fields.evidence).toBeUndefined();
	for (const template of startTemplates) {
		notes.write(template.file, template.source);
	}
	yield* Effect.promise(async () =>
		waitFor(async () => {
			const response = await fetch(`${board.url}/result.md`);
			expect(response.status).toBe(200);
		}),
	);
	const help = yield* Effect.promise(() => renderRemaining(board.url, "/_board/start"));
	expect(help).toContain("Project and report templates");
	expect(yield* Effect.promise(async () => (await fetch(board.url)).text())).not.toContain("Start your local workspace");
	expect(readdirSync(notes.root).sort()).toEqual(["board.sock", ...startTemplates.map((template) => template.file)].sort());
});
