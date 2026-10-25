import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { GITHUB_RESET } from "#test/githubApi.ts";
import { boardWork, host, storedWork } from "#test/hostStory.ts";
import { observedDiagnostics } from "#test/observedDiagnostics.ts";

host.it(
	"Board reads real daemon health, owner counts and Fleet's recorded GitHub budget over HTTP without health files",
	[
		boardWork({}, { concurrency: 8 }),
		...["automation", "maintainer", "orchestrator"].map((owner) => storedWork(owner, "waiting", { attentionOwner: owner })),
		storedWork("queued", "queued"),
		observedDiagnostics,
	],
	function* (daemon) {
		yield* daemon.observeGithubBudget();
		daemon.removeBoard("fleet/health.json");
		daemon.writeBoard("fleet.config.json", "invalid config");
		const { client } = yield* daemon.boardHttp();
		const data = yield* Effect.promise(() => client.run(client.api.diagnostics.run(undefined)));
		expect(data.sources).toMatchObject({
			codex: { state: "ready", value: { primary: { usedPercent: 12 } } },
			fleet: { state: "ready", value: { concurrency: 8, queued: 1, running: 0, waiting: { automation: 1, maintainer: 1, orchestrator: 1 } } },
			github: {
				state: "ready",
				value: [{ limit: 5000, limitedBy: null, limitedUntil: null, remaining: 4567, reset: GITHUB_RESET, resource: "core", used: 433 }],
			},
		});
		const second = yield* daemon.boardHttp();
		yield* Effect.promise(() => second.client.run(second.client.api.diagnostics.run(undefined)));
		expect(daemon.diagnosticReads()).toEqual({ codex: 1, github: ["repos/example/project/pulls/7"] });
	},
);
