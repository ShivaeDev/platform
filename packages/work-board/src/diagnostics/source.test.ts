import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { SourceFailure } from "#diagnostics/source.ts";
import { aTabReadDiagnostics, aTabWaitingOnCodex, configuredSources, diagnosticsStory, offlineCodex } from "#test/diagnosticsStory.ts";

const SOURCES = ["codex", "github", "fleet"] as const;

for (const source of SOURCES) {
	for (const kind of ["not-configured", "error"] as const) {
		diagnosticsStory.it(
			`a ${kind} ${source} source shows its cause while the other sources stay ready`,
			[configuredSources({ [source]: Effect.fail(new SourceFailure({ kind, message: "Provider unavailable" })) })],
			function* ({ sourceStates }) {
				expect(yield* sourceStates()).toEqual({
					...Object.fromEntries(SOURCES.map((other) => [other, "ready"])),
					[source]: `${kind}: Provider unavailable`,
				});
			},
		);
	}
}

diagnosticsStory.it(
	"a second tab reading while Codex answers the first shares that one Codex read",
	[aTabWaitingOnCodex()],
	function* ({ anotherTabReads, codexAnswers, codexReads, waitingTabsSeeCodex }) {
		yield* anotherTabReads();

		yield* codexAnswers();

		yield* outcomes({
			"Codex reads": [codexReads(), 1],
			"waiting tabs": [waitingTabsSeeCodex(), ["ready", "ready"]],
		});
	},
);

diagnosticsStory.it(
	"a Codex answer is reused for 59 seconds and read again once its minute has passed",
	[aTabReadDiagnostics()],
	function* ({ codexReads, secondsPass, tabReads }) {
		yield* secondsPass(59);
		yield* tabReads();
		expect(yield* codexReads()).toBe(1);

		yield* secondsPass(1);
		yield* tabReads();

		expect(yield* codexReads()).toBe(2);
	},
);

diagnosticsStory.it(
	"every tab read asks Fleet and GitHub again while Codex stays cached",
	[aTabReadDiagnostics()],
	function* ({ sourceReads, tabReads }) {
		expect(yield* sourceReads()).toEqual({ codex: 1, fleet: 1, github: 1 });

		yield* tabReads();

		expect(yield* sourceReads()).toEqual({ codex: 1, fleet: 2, github: 2 });
	},
);

diagnosticsStory.it(
	"a failed Codex read stays cached for its minute even after Codex recovers",
	[offlineCodex(), aTabReadDiagnostics()],
	function* ({ codexReads, codexRecovers, tabReads }) {
		yield* codexRecovers();

		yield* outcomes({
			"Codex for the next tab": [tabReads(), "error: Codex offline"],
			"Codex reads": [codexReads(), 1],
		});
	},
);

diagnosticsStory.it(
	"a failed Codex read is retried once its minute has passed",
	[offlineCodex(), aTabReadDiagnostics()],
	function* ({ codexReads, codexRecovers, secondsPass, tabReads }) {
		yield* codexRecovers();

		yield* secondsPass(60);

		yield* outcomes({
			"Codex for the next tab": [tabReads(), "ready"],
			"Codex reads": [codexReads(), 2],
		});
	},
);

diagnosticsStory.it(
	"a tab closed while Codex answers neither poisons the cache nor spends another Codex read",
	[aTabWaitingOnCodex()],
	function* ({ codexAnswers, codexReads, firstTabCloses, tabReads }) {
		yield* firstTabCloses();
		yield* codexAnswers();

		yield* outcomes({
			"Codex for the next tab": [tabReads(), "ready"],
			"Codex reads": [codexReads(), 1],
		});
	},
);
