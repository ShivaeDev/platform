import { NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { engineIntegrations } from "#test/engineIntegrations.ts";
import { task } from "#test/fleetHost.ts";
import { PR } from "#test/githubResult.ts";
import { HostStoryEngine } from "#test/HostStoryEngine.ts";
import { hostDatabase } from "#test/hostDatabase.ts";
import { hostVerbs } from "#test/hostVerbs.ts";
import { legacyStore } from "#test/legacyStore.ts";
import { mergedReviewGithub } from "#test/mergedReviewGithub.ts";
import { postgresEnabled, postgresLayer } from "#test/postgres.ts";

const layer = Layer.merge(postgresLayer, NodeServices.layer);

function otherPullRequest(workId: string) {
	return { head: `head-${workId}`, kind: "change" as const, paths: [`src/${workId}.ts`], pr: "https://github.com/example/repository/pull/8" };
}

function conflictIntegrations(github: Effect.Success<ReturnType<typeof mergedReviewGithub>>) {
	return engineIntegrations(
		{
			checksQuery: (result) =>
				result.kind === "change" && result.pr === PR
					? github.checksQuery(result)
					: Effect.succeed({ evidence: ["Required CI passed"], head: result.head, passed: true }),
			deliveryQuery: (result) => (result.pr === PR ? github.deliveryQuery(result) : Effect.succeed(undefined)),
			resultQuery: (work, observation) =>
				work.workId === "one" ? github.resultQuery(work, observation) : Effect.succeed(otherPullRequest(work.workId)),
		},
		[],
	);
}

export const conflictDaemon = storyKit({
	after: { configuration: (engine: HostStoryEngine) => engine.deploy() },
	around: withIsolatedDatabase,
	clock: "live",
	create: () =>
		Effect.gen(function* () {
			const engine = new HostStoryEngine();
			const github = yield* mergedReviewGithub();
			engine.pullRequest = github;
			engine.files = Object.fromEntries(["one", "other", "new"].map((id) => [`${id}.md`, task(id, "approved")]));
			engine.config = { concurrency: 4, intervalSeconds: 3600, openPullRequests: { ease: 0, floor: 0, max: 1 } };
			engine.integrations = conflictIntegrations(github);
			return engine;
		}),
	inspect: (engine) => engine.inspect(),
	layer,
	name: "Fleet conflicting delivery",
	runIf: postgresEnabled,
	stages: ["configuration", "observation"],
	verbs: (engine, story) => ({
		...hostVerbs(engine, story.tell),
		conflict: () => {
			story.tell("GitHub reports a conflict with main for the reviewed PR");
			if (engine.pullRequest === undefined) {
				throw new Error("Missing fake GitHub");
			}
			engine.pullRequest.state.mergeable = "CONFLICTING";
		},
	}),
});

export const reviewedAtCapacity = conflictDaemon.trait(
	"observation",
	"a reviewed PR and another open PR exhaust the implementer budget",
	function* (engine) {
		const verbs = hostVerbs(engine, () => undefined);
		const one = yield* verbs.dispatch("one");
		const other = yield* verbs.dispatch("other");
		verbs.finishReviewedWorker(one);
		yield* verbs.reconcile("one");
		verbs.finishTurn(other);
		yield* verbs.reconcile("other");
	},
);

export const legacyConflictQuestion = conflictDaemon.trait(
	"observation",
	"an earlier Fleet stored the published conflict question in reviewing",
	function* (engine) {
		const verbs = hostVerbs(engine, () => undefined);
		if (engine.pullRequest === undefined) {
			throw new Error("Missing fake GitHub");
		}
		engine.pullRequest.state.mergeable = "CONFLICTING";
		yield* verbs.schedulerPass();
		verbs.finishReviewedWorker(yield* verbs.get("one"));
		yield* verbs.schedulerPass();
		const question = yield* verbs.get("one");
		yield* engine.stop();
		yield* engine.store("one", { ...question, step: "reviewing" });
		yield* legacyStore(engine.fixture.host.namespace).pipe(Effect.provide(hostDatabase(engine.fixture.host, "fleet-conflict-upgrade", 1)));
		yield* engine.start();
	},
);

export const reviewedWithBusySlot = conflictDaemon.trait(
	"observation",
	"a reviewed PR waits beside a worker occupying the only execution slot",
	function* (engine) {
		const verbs = hostVerbs(engine, () => undefined);
		const one = yield* verbs.dispatch("one");
		yield* verbs.dispatch("other");
		verbs.finishReviewedWorker(one);
		yield* verbs.reconcile("one");
		yield* verbs.editConfig({ concurrency: 1 });
		yield* verbs.waitForConfig((config) => config.settings.concurrency === 1);
	},
);
