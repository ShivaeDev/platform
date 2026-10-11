import { Effect } from "effect";
import { afterEach, expect, it } from "vitest";
import { SourceFailure } from "#diagnostics/source.ts";
import { type Folder, folder, type RunningBoard, rawGet, startBoard } from "#test/board.ts";
import { health, syntheticSources } from "#test/diagnostics.ts";
import { diagnosticsHtml } from "./html.ts";

let notes: Folder;
let board: RunningBoard;
afterEach(async () => {
	await board?.stop();
	notes?.remove();
});

it("links Diagnostics from the sidebar and renders all three sources through normal HTTP", async () => {
	notes = folder({ "home.md": "# Home" });
	board = await startBoard(notes.root, "home.md", undefined, false, syntheticSources());
	const response = await rawGet(board, "/_board/diagnostics");
	expect(response.status).toBe(200);
	expect(response.body).toContain('id="diagnostics-open" class="start-open" href="/_board/diagnostics" aria-current="page"');
	for (const text of ["24% used", "63% used", "4321 / 5000", "3210 / 5000", "3 / 8", "Provider is at capacity", "Last scheduler pass"]) {
		expect(response.body).toContain(text);
	}
	expect(response.body).toContain('data-view="diagnostics"');
	expect((await rawGet(board, "/")).body).toContain('href="/_board/diagnostics"');
	expect((await rawGet(board, "/_board/diagnostics", "example.invalid")).status).toBe(403);
});

it("source failures leave the page usable and escape their causes", async () => {
	notes = folder({});
	board = await startBoard(
		notes.root,
		undefined,
		undefined,
		false,
		syntheticSources({
			codex: Effect.fail(new SourceFailure({ kind: "not-configured", message: "Codex missing" })),
			github: Effect.fail(new SourceFailure({ kind: "error", message: "<script>bad</script>" })),
		}),
	);
	const response = await rawGet(board, "/_board/diagnostics");
	expect(response.status).toBe(200);
	expect(response.body).toContain("Not configured");
	expect(response.body).toContain("Unavailable");
	expect(response.body).toContain("&lt;script&gt;bad&lt;/script&gt;");
	expect(response.body).toContain("3 / 8");
});

it("shows Fleet freshness, unobserved scheduler and rejection, unknown Codex windows and exhausted limits", () => {
	const sources = {
		codex: { observedAt: health.observedAt, state: "ready", value: { primary: null, secondary: null } },
		fleet: {
			observedAt: health.observedAt,
			state: "ready",
			value: { ...health, lastCapacityRejection: null, lastSchedulerPass: null, needsHuman: 0 },
		},
		github: {
			observedAt: health.observedAt,
			state: "ready",
			value: { core: { limit: 5000, remaining: 0, reset: 0 }, graphql: { limit: 5000, remaining: 1, reset: 0 } },
		},
	} as const;
	expect(diagnosticsHtml(sources, health.observedAt)).toContain("Current snapshot");
	const stale = diagnosticsHtml(sources, health.observedAt + 60_001);
	for (const text of ["Stale snapshot", "None observed", "Not reported", "Window not reported", "Needs attention"]) {
		expect(stale).toContain(text);
	}
	expect(diagnosticsHtml(sources, health.observedAt - 1)).toContain("Publisher clock is ahead");
});
