import { Effect } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { SourceFailure } from "#diagnostics/source.ts";
import { type Folder, folder, type RunningBoard, rawGet, startBoard } from "#test/board.ts";
import { codexResponse, githubObservations, health, syntheticSources } from "#test/diagnostics.ts";
import { renderDiagnostics as diagnosticsHtml, renderRemaining } from "#test/remainingRendering.tsx";

let notes: Folder;
let board: RunningBoard;

afterEach(() => {
	notes?.remove();
});

it.live("links Diagnostics from the sidebar and renders all three sources through normal HTTP", function* () {
	notes = folder({ "home.md": "# Home" });
	board = yield* startBoard(notes.root, "home.md", undefined, false, syntheticSources());
	const response = yield* rawGet(board, "/_board/system");
	expect(response.status).toBe(200);
	expect(response.body).toContain("/_board/react.js");
	const body = yield* Effect.promise(() => renderRemaining(board.url, "/_board/system"));
	for (const text of [
		"24% used",
		"63% used",
		"4321 / 5000",
		"0 / 5000",
		"3 / 8",
		"Provider is at capacity",
		"Last scheduler pass",
		"Waiting on maintainer",
		"Waiting on orchestrator",
		"Waiting on automation",
	]) {
		expect(body).toContain(text);
	}
	for (const [owner, count] of Object.entries(health.waiting)) {
		expect(body).toContain(`<dt>Waiting on ${owner}</dt><dd><strong>${count}</strong>`);
	}
	expect((yield* rawGet(board, "/_board/system", "example.invalid")).status).toBe(403);
});

it.live("source failures leave the page usable and escape their causes", function* () {
	notes = folder({});
	board = yield* startBoard(
		notes.root,
		undefined,
		undefined,
		false,
		syntheticSources({
			codex: Effect.fail(new SourceFailure({ kind: "not-configured", message: "Codex missing" })),
			github: Effect.fail(new SourceFailure({ kind: "error", message: "<script>bad</script>" })),
		}),
	);
	const response = yield* rawGet(board, "/_board/system");
	expect(response.status).toBe(200);
	const body = yield* Effect.promise(() => renderRemaining(board.url, "/_board/system"));
	expect(body).toContain("Not configured");
	expect(body).toContain("Unavailable");
	expect(body).toContain("&lt;script&gt;bad&lt;/script&gt;");
	expect(body).toContain("3 / 8");
});

it("shows Fleet freshness, unobserved scheduler and rejection, unknown Codex windows and exhausted limits", () => {
	const sources = {
		codex: { observedAt: health.observedAt, state: "ready", value: { primary: null, secondary: null } },
		fleet: {
			observedAt: health.observedAt,
			state: "ready",
			value: { ...health, lastCapacityRejection: null, lastSchedulerPass: null, waiting: { automation: 0, maintainer: 0, orchestrator: 0 } },
		},
		github: {
			observedAt: health.observedAt,
			state: "ready",
			value: [
				{ limit: 5000, limitedBy: null, limitedUntil: null, observedAt: health.observedAt, remaining: 0, reset: 0, resource: "core", used: 5000 },
			],
		},
	} as const;
	expect(diagnosticsHtml(sources, health.observedAt)).toContain("Current snapshot");
	const stale = diagnosticsHtml(sources, health.observedAt + 60_001);
	for (const text of ["Stale snapshot", "None observed", "Not reported", "Window not reported", "Needs attention"]) {
		expect(stale).toContain(text);
	}
	expect(diagnosticsHtml(sources, health.observedAt - 1)).toContain("Publisher clock is ahead");
});

it("renders each GitHub resource Fleet recorded with its age and the rate limit or reserve pause it is waiting out", () => {
	const now = health.observedAt;
	const html = diagnosticsHtml(
		{
			codex: { cause: "Missing", observedAt: now, state: "not-configured" },
			fleet: { cause: "Missing", observedAt: now, state: "not-configured" },
			github: { observedAt: now, state: "ready", value: githubObservations },
		},
		now,
	);
	const github = html.slice(html.indexOf('data-source="github"'), html.indexOf("</article>", html.indexOf('data-source="github"')));
	expect(github).toContain('data-state="attention"');
	const rest = github.slice(github.indexOf('data-resource="core"'), github.indexOf('data-resource="graphql"'));
	expect(rest).toContain("<dt>REST</dt>");
	expect(rest).toContain("4321 / 5000");
	expect(rest).toContain("1 min ago");
	expect(rest).not.toContain("Rate-limited");
	const graphql = github.slice(github.indexOf('data-resource="graphql"'), github.indexOf('data-resource="search"'));
	expect(graphql).toContain("<dt>GraphQL</dt>");
	expect(graphql).toContain("0 / 5000");
	expect(graphql).toContain("<strong>Rate-limited</strong> until");
	expect(graphql).toContain("5 min ago");
	const search = github.slice(github.indexOf('data-resource="search"'));
	expect(search).toContain("<dt>Search</dt>");
	expect(search).toContain("5 / 30");
	expect(search).toContain("<strong>GitHub paused below the 20% reserve</strong> until");
	expect(search).not.toContain("Rate-limited");
	expect(github).toContain("Recorded from the rate-limit headers of Fleet&#x27;s own GitHub responses.");
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
	expect(fleet).toContain(">Stale</span>");
	expect(fleet).toContain(`Observed <time dateTime="${new Date(health.observedAt).toISOString()}"`);
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
