import { Effect } from "effect";
import { afterEach, expect, it } from "vitest";
import { SourceFailure } from "#diagnostics/source.ts";
import { type Folder, folder, type RunningBoard, rawGet, startBoard } from "#test/board.ts";
import { codexResponse, health, syntheticSources } from "#test/diagnostics.ts";
import { diagnosticsHtml } from "./html.ts";

let notes: Folder;
let board: RunningBoard;
afterEach(async () => {
	await board?.stop();
	notes?.remove();
});

it("links Diagnostics from the header and renders all three sources through normal HTTP", async () => {
	notes = folder({ "home.md": "# Home" });
	board = await startBoard(notes.root, "home.md", undefined, false, syntheticSources());
	const response = await rawGet(board, "/_board/diagnostics");
	expect(response.status).toBe(200);
	expect(response.body).toContain('id="diagnostics-open" class="work-open" href="/_board/diagnostics" aria-current="page"');
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

it("marks stale Fleet counts and uses the snapshot observation instead of the Board read time", () => {
	const readAt = health.observedAt + 120_000;
	const html = diagnosticsHtml(
		{
			codex: { cause: "Missing", observedAt: readAt, state: "not-configured" },
			fleet: { observedAt: readAt, state: "ready", value: health },
			github: { cause: "Missing", observedAt: readAt, state: "not-configured" },
		},
		readAt,
	);
	const fleet = html.slice(html.indexOf('data-source="fleet"'));
	expect(fleet).toContain('data-state="stale"');
	expect(fleet).toContain('class="diagnostics-status">Stale</span>');
	expect(fleet).toContain(`Observed <time datetime="${new Date(health.observedAt).toISOString()}"`);
	expect(fleet).not.toContain(new Date(readAt).toISOString());
});

it("labels Codex windows by duration and renders local and relative resets", () => {
	const now = (codexResponse.rateLimits.primary.resetsAt - 3 * 3600) * 1000;
	const sources = {
		codex: { observedAt: now, state: "ready", value: codexResponse.rateLimits },
		fleet: { cause: "Missing", observedAt: now, state: "not-configured" },
		github: { cause: "Missing", observedAt: now, state: "not-configured" },
	} as const;
	const html = diagnosticsHtml(sources, now);
	expect(html).toContain("<h3>5-hour</h3>");
	expect(html).toContain("<h3>Weekly</h3>");
	expect(html).toContain(
		`in 3 h, ${new Date(codexResponse.rateLimits.primary.resetsAt * 1000).toLocaleTimeString(undefined, { hour: "2-digit", hour12: false, minute: "2-digit" })}`,
	);
	for (const [minutes, label] of [
		[30, "30-minute"],
		[2880, "2-day"],
		[null, "Primary — duration not reported"],
	] as const) {
		expect(
			diagnosticsHtml(
				{
					...sources,
					codex: { ...sources.codex, value: { primary: { ...codexResponse.rateLimits.primary, windowDurationMins: minutes }, secondary: null } },
				},
				now,
			),
		).toContain(`<h3>${label}</h3>`);
	}
});
