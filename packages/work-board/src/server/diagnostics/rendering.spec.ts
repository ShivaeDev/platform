import { Effect } from "effect";
import { expect } from "vitest";
import { SourceFailure } from "#diagnostics/source.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { codexResponse, githubObservations, health, syntheticSources } from "#test/diagnostics.ts";
import { daemonSnapshot, diagnosticsSources, readingTime } from "#test/readingTraits.ts";

boardStory.it(
	"serves System and renders each provider through normal HTTP",
	[projectFiles({ "home.md": "# Home" }), diagnosticsSources(syntheticSources())],
	function* ({ getPage, systemHtml }) {
		expect((yield* getPage("/_board/system")).status).toBe(200);
		const body = yield* systemHtml();
		for (const text of ["24% used", "63% used", "4321 / 5000", "0 / 5000", "3 / 8", "Provider is at capacity", "Last scheduler pass"]) {
			expect(body).toContain(text);
		}
		expect(body).toContain("<dt>Needs you</dt>");
		expect(body).not.toContain("Waiting on maintainer");
		expect(body).toContain("<dt>Waiting on the orchestrator</dt><dd><strong>3</strong>");
		expect(body).toContain("<dt>Waiting on Fleet agents</dt><dd><strong>1</strong>");
		expect((yield* getPage("/_board/system", "example.invalid")).status).toBe(403);
	},
);

boardStory.it(
	"source failures leave System usable and escape their causes",
	[
		diagnosticsSources(
			syntheticSources({
				codex: Effect.fail(new SourceFailure({ kind: "not-configured", message: "Codex missing" })),
				github: Effect.fail(new SourceFailure({ kind: "error", message: "<script>bad</script>" })),
			}),
		),
	],
	function* ({ systemHtml }) {
		const body = yield* systemHtml();
		expect(body).toContain("Not configured");
		expect(body).toContain("Unavailable");
		expect(body).toContain("&lt;script&gt;bad&lt;/script&gt;");
		expect(body).toContain("3 / 8");
	},
);

const now = health.observedAt;
const missing = { cause: "Missing", observedAt: now, state: "not-configured" as const };
const unobserved = {
	codex: { observedAt: now, state: "ready", value: { primary: null, secondary: null } },
	fleet: {
		observedAt: now,
		state: "ready",
		value: { ...health, lastCapacityRejection: null, lastSchedulerPass: null, waiting: { automation: 0, maintainer: 0, orchestrator: 0 } },
	},
	github: {
		observedAt: now,
		state: "ready",
		value: [{ limit: 5000, limitedBy: null, limitedUntil: null, observedAt: now, remaining: 0, reset: 0, resource: "core", used: 5000 }],
	},
} as const;
for (const [readAt, label] of [
	[now, "Current snapshot"],
	[now + 60_001, "Stale snapshot"],
	[now - 1, "Publisher clock is ahead"],
] as const) {
	boardStory.it(
		`discloses ${label} without inventing missing observations`,
		[readingTime(readAt), daemonSnapshot(() => unobserved)],
		function* ({ systemHtml }) {
			const body = yield* systemHtml();
			expect(body).toContain(label);
			for (const text of ["None observed", "Not reported", "Window not reported", "Needs attention"]) {
				expect(body).toContain(text);
			}
		},
	);
}

boardStory.it(
	"shows each recorded GitHub resource with its own age and pause reason",
	[
		readingTime(now),
		daemonSnapshot(() => ({ codex: missing, fleet: missing, github: { observedAt: now, state: "ready", value: githubObservations } })),
	],
	function* ({ systemHtml }) {
		const html = yield* systemHtml();
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
	},
);

boardStory.it(
	"uses Fleet's observation time instead of the Board read time for stale counts",
	[
		readingTime(now + 120_000),
		daemonSnapshot(() => ({ codex: missing, fleet: { observedAt: now + 120_000, state: "ready", value: health }, github: missing })),
	],
	function* ({ systemHtml }) {
		const html = yield* systemHtml();
		const fleet = html.slice(html.indexOf('data-source="fleet"'));
		expect(fleet).toContain('data-state="stale"');
		expect(fleet).toContain(">Stale</span>");
		expect(fleet).toContain(`Observed <time dateTime="${new Date(now).toISOString()}"`);
		expect(fleet).not.toContain(new Date(now + 120_000).toISOString());
	},
);

const resetNow = (codexResponse.rateLimits.primary.resetsAt - 3 * 3600) * 1000;
boardStory.it(
	"labels Codex windows by duration with local and relative resets",
	[
		readingTime(resetNow),
		daemonSnapshot(() => ({ codex: { observedAt: resetNow, state: "ready", value: codexResponse.rateLimits }, fleet: missing, github: missing })),
	],
	function* ({ systemHtml }) {
		const html = yield* systemHtml();
		expect(html).toContain("<h3>5-hour</h3>");
		expect(html).toContain("<h3>Weekly</h3>");
		expect(html).toContain(
			`in 3 h, ${new Date(codexResponse.rateLimits.primary.resetsAt * 1000).toLocaleTimeString(undefined, { hour: "2-digit", hour12: false, minute: "2-digit" })}`,
		);
	},
);
for (const [minutes, label] of [
	[30, "30-minute"],
	[2880, "2-day"],
	[null, "Primary — duration not reported"],
] as const) {
	boardStory.it(
		`labels a ${label} Codex window`,
		[
			readingTime(resetNow),
			daemonSnapshot(() => ({
				codex: {
					observedAt: resetNow,
					state: "ready",
					value: { primary: { ...codexResponse.rateLimits.primary, windowDurationMins: minutes }, secondary: null },
				},
				fleet: missing,
				github: missing,
			})),
		],
		function* ({ systemHtml }) {
			expect(yield* systemHtml()).toContain(`<h3>${label}</h3>`);
		},
	);
}
