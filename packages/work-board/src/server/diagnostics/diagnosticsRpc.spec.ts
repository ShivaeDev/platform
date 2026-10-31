import { Clock, Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { diagnosticsSnapshot, health } from "#test/diagnostics.ts";
import { daemonSnapshot } from "#test/readingTraits.ts";

boardStory.it(
	"System shows the daemon's Fleet health over HTTP RPC and ignores a conflicting health file in the project",
	[projectFiles({ "fleet/health.json": JSON.stringify({ ...health, running: 99 }) }), daemonSnapshot(diagnosticsSnapshot)],
	function* ({ systemCardFacts }) {
		expect(yield* systemCardFacts("fleet")).toEqual(
			expect.objectContaining({
				Queued: "5",
				"Running / concurrency cap": "3 / 8",
				"Waiting on automation": "1",
				"Waiting on orchestrator": "3",
			}),
		);
	},
);

boardStory.it("System shows Codex and GitHub usage from the daemon over HTTP RPC", [daemonSnapshot(diagnosticsSnapshot)], function* ({ systemText }) {
	expect(yield* systemText()).toEqual(expect.stringMatching(/24% used.*4321 of 5000/u));
});

const twoMinutesAgo = Effect.runSync(Clock.currentTimeMillis) - 120_000;

boardStory.it(
	"a daemon snapshot two minutes old shows Fleet as stale with the time it was observed",
	[daemonSnapshot(() => diagnosticsSnapshot(twoMinutesAgo))],
	function* ({ systemCards, systemCardText, systemCardTimes }) {
		yield* outcomes([
			["fleet card", () => systemCards(), expect.objectContaining({ fleet: "stale" })],
			["fleet text", () => systemCardText("fleet"), expect.stringContaining("Stale snapshot")],
			["fleet times", () => systemCardTimes("fleet"), expect.arrayContaining([`2m ago at ${new Date(twoMinutesAgo).toISOString()}`])],
		]);
	},
);

const stoppedDaemon = daemonSnapshot(diagnosticsSnapshot, true);

boardStory.it(
	"a stopped Fleet daemon shows only a Fleet isn't running card with how to start it",
	[stoppedDaemon],
	function* ({ systemCards, systemCardText, systemRegions, systemText }) {
		yield* outcomes([
			["cards", () => systemCards(), { fleet: "stopped" }],
			["daemon address shown", () => systemText(), expect.not.stringContaining("127.0.0.1:")],
			[
				"fleet card",
				() => systemCardText("fleet"),
				expect.stringMatching(/Fleet isn't running, so agent work and its health are unknown\..*How to start Fleet/u),
			],
			["regions", () => systemRegions(), expect.not.arrayContaining(["Fleet work"])],
		]);
	},
);

boardStory.it(
	"System recovers on its next read once a stopped Fleet daemon starts again",
	[stoppedDaemon],
	function* ({ fleetDaemonRestarts, systemCards }) {
		expect(yield* systemCards()).toEqual({ fleet: "stopped" });

		yield* fleetDaemonRestarts();

		expect(yield* systemCards()).toMatchObject({ fleet: "ready" });
	},
);

boardStory.it(
	"failed Codex and GitHub sources keep their own states, with the GitHub cause shown as text, while Fleet health stays visible",
	[
		daemonSnapshot((observedAt) => ({
			...diagnosticsSnapshot(observedAt),
			codex: { cause: "Codex missing", observedAt, state: "not-configured" },
			github: { cause: "<script>upstream failed</script>", observedAt, state: "error" },
		})),
	],
	function* ({ systemCards, systemCardText }) {
		yield* outcomes([
			["cards", () => systemCards(), expect.objectContaining({ codex: "not-configured", fleet: "ready", github: "error" })],
			["github cause", () => systemCardText("github"), expect.stringContaining("<script>upstream failed</script>")],
		]);
	},
);
