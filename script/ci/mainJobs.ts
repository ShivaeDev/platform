import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Config, Console, Effect, Schema } from "effect";
import { read } from "@shivaedev/github/GitHub.ts";
import { JobTiming, jobTiming } from "#ci/adapters/jobTiming.ts";
import { githubLayer } from "#lib/githubLayer.ts";

const Jobs = Schema.Struct({
	jobs: Schema.Array(JobTiming),
});

NodeRuntime.runMain(
	Effect.gen(function* () {
		const repository = yield* Config.String("GITHUB_REPOSITORY");
		const runId = yield* Config.String("GITHUB_RUN_ID");
		const jobs = yield* read(`/repos/${repository}/actions/runs/${runId}/jobs?filter=latest&per_page=100`, Jobs);
		yield* Console.log(yield* Schema.encodeEffect(Schema.fromJsonString(Jobs))({ jobs: jobs.jobs.map(jobTiming) }));
	}).pipe(Effect.provide(githubLayer)),
);
