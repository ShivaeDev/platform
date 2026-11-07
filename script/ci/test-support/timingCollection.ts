import { Effect, Fiber, Layer, Option, Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import { GitHubConfig } from "@shivaedev/github/GitHubConfig.ts";
import { GitHubToken } from "@shivaedev/github/GitHubToken.ts";
import { GitHub } from "@shivaedev/github/github/service.ts";
import { fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { passes, untilTimer } from "@shivaedev/test-story/server/watchedClock.ts";
import { QueueJobs, queueJobTimings } from "#ci/queueJobTimings.ts";
import { mergeTimingArtifacts } from "#ci/test-support/mergeTimingArtifacts.ts";
import { workflowJob } from "#ci/test-support/workflowJob.ts";
import { workspace } from "#ci/test-support/workspace.ts";
import type { TimingSnapshot } from "#ci/timings.ts";

export const timingCollection = storyKit({
	clock: "test",
	*create() {
		const engine = yield* workspace();
		const state: { reads: number; responses: readonly unknown[] } = { reads: 0, responses: [] };
		const collection: { fiber?: Fiber.Fiber<TimingSnapshot, unknown> } = {};
		const server = yield* fakeHttpService({
			routes: {
				jobs: {
					path: "/repos/owner/repo/actions/runs/42/jobs",
					reply: () => {
						const body = state.responses[Math.min(state.reads, state.responses.length - 1)];
						state.reads += 1;
						return { body };
					},
				},
			},
		});
		const context = yield* Layer.build(
			GitHub.layer.pipe(
				Layer.provide(
					Layer.mergeAll(FetchHttpClient.layer, Layer.succeed(GitHubToken)(Option.none()), Layer.succeed(GitHubConfig)({ apiUrl: server.url })),
				),
			),
		);
		return { ...engine, collection, context, server, state };
	},
	name: "Merge-queue timing collection",
	stages: ["workspace"],
	verbs: (engine) => ({
		collectedSnapshot: () =>
			engine.collection.fiber === undefined ? Effect.die("Start timing collection first") : Fiber.join(engine.collection.fiber),
		jobsReads: () => engine.server.requests.map((request) => request.path),
		retryIntervalPasses: () => untilTimer("5 seconds").pipe(Effect.andThen(passes("5 seconds", Effect.void))),
		startCollection: () =>
			Effect.gen(function* () {
				engine.collection.fiber = yield* queueJobTimings("owner/repo", "42").pipe(
					Effect.provide(engine.context),
					Effect.flatMap((jobs) =>
						Effect.try(() => {
							engine.jobs = Schema.encodeSync(QueueJobs)(jobs);
							return mergeTimingArtifacts(engine);
						}),
					),
					Effect.forkScoped,
				);
			}),
	}),
});

export function laggingJobs(mode: "later" | "never" | "failed") {
	return timingCollection.trait("workspace", `one test job is ${mode === "failed" ? "failed" : `not final: ${mode}`}`, (engine) => {
		const final = {
			jobs: [workflowJob("tests (1)", 300), workflowJob("tests (2)", 200), { ...workflowJob("verify", 1), "completed_at": null, conclusion: null }],
		};
		const unfinished = {
			jobs: [
				final.jobs[0],
				{
					...final.jobs[1],
					"completed_at": mode === "failed" ? final.jobs[1]?.completed_at : null,
					conclusion: mode === "failed" ? "failure" : null,
				},
				final.jobs[2],
			],
		};
		engine.state.responses = mode === "later" ? [unfinished, final] : [unfinished];
	});
}
