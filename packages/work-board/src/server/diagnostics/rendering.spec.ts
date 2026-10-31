import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { SourceFailure } from "#diagnostics/source.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { codexResponse, githubObservations, health, syntheticSources } from "#test/diagnostics.ts";
import { codexOnlySnapshot, daemonSnapshot, diagnosticsSources, readingTime } from "#test/readingTraits.ts";

const allSources = [projectFiles({ "home.md": "# Home" }), diagnosticsSources(syntheticSources())];

for (const [reader, host, status] of [
	["a local reader", undefined, 200],
	["a reader addressing the board as another host", "example.invalid", 403],
] as const) {
	boardStory.it(`System answers ${reader} with status ${status}`, allSources, function* ({ systemPageStatus }) {
		expect(yield* systemPageStatus(host)).toBe(status);
	});
}

boardStory.it("System shows the figures each provider reports", allSources, function* ({ githubResources, systemCardFacts, systemCardLimits }) {
	yield* outcomes({
		"codex limits": [systemCardLimits("codex"), { "5-hour limit": "24% used", "Weekly limit": "63% used" }],
		"fleet facts": [
			systemCardFacts("fleet"),
			expect.objectContaining({
				"Last provider capacity rejection": expect.stringContaining("Provider is at capacity"),
				"Last scheduler pass": expect.any(String),
				"Running / concurrency cap": "3 / 8",
				"Waiting on automation": "1",
				"Waiting on orchestrator": "3",
			}),
		],
		"github resources": [
			githubResources(),
			{
				core: expect.stringContaining("4321 of 5000 requests left"),
				graphql: expect.stringContaining("0 of 5000 requests left"),
				search: expect.stringContaining("5 of 30 requests left"),
			},
		],
	});
});

boardStory.it("System labels the maintainer's count Needs you, never Waiting on you", allSources, function* ({ systemCardFacts, systemText }) {
	yield* outcomes({
		"fleet facts": [systemCardFacts("fleet"), expect.objectContaining({ "Needs you": expect.any(String) })],
		"page text": [systemText(), expect.not.stringContaining("Waiting on you")],
	});
});

boardStory.it(
	"failed Codex and GitHub sources keep System usable, show their own state and print the cause as text",
	[
		diagnosticsSources(
			syntheticSources({
				codex: Effect.fail(new SourceFailure({ kind: "not-configured", message: "Codex missing" })),
				github: Effect.fail(new SourceFailure({ kind: "error", message: "<script>bad</script>" })),
			}),
		),
	],
	function* ({ systemCards, systemCardText }) {
		yield* outcomes({
			cards: [systemCards(), { codex: "not-configured", fleet: "attention", github: "error" }],
			"codex card": [systemCardText("codex"), expect.stringContaining("Not configured")],
			"github card": [systemCardText("github"), expect.stringMatching(/Unavailable.*<script>bad<\/script>/u)],
		});
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
		`a snapshot read ${readAt - now} milliseconds after it was observed is labelled ${label}`,
		[readingTime(readAt), daemonSnapshot(() => unobserved)],
		function* ({ systemText }) {
			expect(yield* systemText()).toContain(label);
		},
	);
}

boardStory.it(
	"observations a source leaves out read as not reported instead of invented values",
	[readingTime(now), daemonSnapshot(() => unobserved)],
	function* ({ systemCardFacts, systemCardLimits, systemCards, systemCardText }) {
		yield* outcomes({
			cards: [systemCards(), expect.objectContaining({ github: "attention" })],
			"codex limits": [systemCardLimits("codex"), { "Long limit": "Not reported", "Short limit": "Not reported" }],
			"fleet capacity rejection": [systemCardText("fleet"), expect.stringContaining("None observed")],
			"fleet facts": [systemCardFacts("fleet"), expect.objectContaining({ "Last scheduler pass": "Not reported" })],
		});
	},
);

boardStory.it(
	"System shows each GitHub resource Fleet recorded with its own age and the reason it is paused",
	[
		readingTime(now),
		daemonSnapshot(() => ({ codex: missing, fleet: missing, github: { observedAt: now, state: "ready", value: githubObservations } })),
	],
	function* ({ githubResources, systemCards, systemCardText }) {
		yield* outcomes({
			cards: [systemCards(), expect.objectContaining({ github: "attention" })],
			"github card": [
				systemCardText("github"),
				expect.stringMatching(/GitHub request limits.*Fleet reads these limits from its own GitHub requests\. The Board does not call GitHub\./u),
			],
			resources: [
				githubResources(),
				{
					core: "REST API 4321 of 5000 requests left Resets just now Checked 1m ago",
					graphql: "GraphQL API 0 of 5000 requests left GitHub is blocking requests. Resumes in 10m Resets just now Checked 5m ago",
					search: "Search API 5 of 30 requests left Fleet paused to keep 20% in reserve. Resumes in 1m Resets in 1m Checked just now",
				},
			],
		});
	},
);

boardStory.it(
	"Fleet counts observed two minutes before the read are stale and show Fleet's observation time, not the read time",
	[
		readingTime(now + 120_000),
		daemonSnapshot(() => ({ codex: missing, fleet: { observedAt: now + 120_000, state: "ready", value: health }, github: missing })),
	],
	function* ({ systemCards, systemCardText, systemCardTimes }) {
		yield* outcomes({
			cards: [systemCards(), expect.objectContaining({ fleet: "stale" })],
			"fleet card": [systemCardText("fleet"), expect.stringContaining("Stale")],
			"fleet times": [
				systemCardTimes("fleet"),
				["2m ago at 2027-01-15T08:00:00.000Z", "2m ago at 2027-01-15T07:59:50.000Z", "2m ago at 2027-01-15T08:00:00.000Z"],
			],
		});
	},
);

const resetNow = (codexResponse.rateLimits.primary.resetsAt - 3 * 3600) * 1000;

boardStory.it(
	"Codex usage names each window by its length and shows when it resets, relative and exact",
	[readingTime(resetNow), codexOnlySnapshot(resetNow, codexResponse.rateLimits)],
	function* ({ systemCardLimits, systemCardTimes }) {
		yield* outcomes({
			limits: [systemCardLimits("codex"), { "5-hour limit": "24% used", "Weekly limit": "63% used" }],
			times: [
				systemCardTimes("codex"),
				["in 3h at 2027-01-15T08:00:00.000Z", "in 1d at 2027-01-16T08:00:00.000Z", "just now at 2027-01-15T05:00:00.000Z"],
			],
		});
	},
);

boardStory.it(
	"a Codex window without a reset time says its reset is not reported",
	[readingTime(resetNow), codexOnlySnapshot(resetNow, { primary: { ...codexResponse.rateLimits.primary, resetsAt: null }, secondary: null })],
	function* ({ systemCardText }) {
		expect(yield* systemCardText("codex")).toContain("Resets Not reported");
	},
);

for (const [minutes, label] of [
	[30, "30-minute limit"],
	[2880, "2-day limit"],
	[null, "Short limit (length not reported)"],
] as const) {
	boardStory.it(
		`a Codex window of ${minutes ?? "unreported"} minutes is called ${label}`,
		[
			readingTime(resetNow),
			codexOnlySnapshot(resetNow, { primary: { ...codexResponse.rateLimits.primary, windowDurationMins: minutes }, secondary: null }),
		],
		function* ({ systemCardLimits }) {
			expect(yield* systemCardLimits("codex")).toEqual({ [label]: "24% used", "Long limit": "Not reported" });
		},
	);
}
