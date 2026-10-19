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
		for (const text of ["24% used", "63% used", "4321 of 5000", "0 of 5000", "3 / 8", "Provider is at capacity", "Last scheduler pass"]) {
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
			for (const text of ["None observed", "<h3>Short limit</h3><p>Not reported</p>", "<h3>Long limit</h3><p>Not reported</p>", "Needs attention"]) {
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
		expect(rest).toContain("<dt>REST API</dt>");
		expect(rest).toContain("4321 of 5000</strong> requests left");
		expect(rest).toContain(">1m ago</time>");
		expect(rest).not.toContain("Resumes");
		const graphql = github.slice(github.indexOf('data-resource="graphql"'), github.indexOf('data-resource="search"'));
		expect(graphql).toContain("<dt>GraphQL API</dt>");
		expect(graphql).toContain("0 of 5000");
		expect(graphql).toContain("<strong>GitHub is blocking requests</strong>. Resumes");
		expect(graphql).toContain(">5m ago</time>");
		expect(graphql).toContain(">in 10m</time>");
		const search = github.slice(github.indexOf('data-resource="search"'));
		expect(search).toContain("<dt>Search API</dt>");
		expect(search).toContain("5 of 30");
		expect(search).toContain("<strong>Fleet paused to keep 20% in reserve</strong>. Resumes");
		expect(search).not.toContain("GitHub is blocking requests");
		expect(github).toContain("Fleet reads these limits from its own GitHub requests. The Board does not call GitHub.");
		expect(github).toContain("GitHub request limits");
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
		expect(fleet).toContain(`dateTime="${new Date(now).toISOString()}">2m ago</time>`);
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
		expect(html).toContain("<h3>5-hour limit</h3>");
		expect(html).toContain("<h3>Weekly limit</h3>");
		expect(html).toContain("Codex usage");
		expect(html).toContain(`dateTime="${new Date(codexResponse.rateLimits.primary.resetsAt * 1000).toISOString()}">in 3h</time>`);
	},
);
for (const [minutes, label] of [
	[30, "30-minute limit"],
	[2880, "2-day limit"],
	[null, "Short limit (length not reported)"],
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
