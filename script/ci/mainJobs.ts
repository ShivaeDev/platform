import { NodeRuntime } from "@effect/platform-node";
import { Config, Console, Effect, Schema } from "effect";
import { read } from "@shivaedev/github/GitHub.ts";
import { githubLayer } from "#lib/githubLayer.ts";

const Jobs = Schema.Struct({
	jobs: Schema.Array(
		Schema.Struct({
			completedAt: Schema.NullOr(Schema.String),
			conclusion: Schema.NullOr(Schema.String),
			name: Schema.String,
			startedAt: Schema.NullOr(Schema.String),
		}).pipe(Schema.encodeKeys({ completedAt: "completed_at", startedAt: "started_at" })),
	),
});

NodeRuntime.runMain(
	Effect.gen(function* () {
		const repository = yield* Config.String("GITHUB_REPOSITORY");
		const runId = yield* Config.String("GITHUB_RUN_ID");
		const jobs = yield* read(`/repos/${repository}/actions/runs/${runId}/jobs?filter=latest&per_page=100`, Jobs);
		yield* Console.log(yield* Schema.encodeEffect(Schema.fromJsonString(Jobs))(jobs));
	}).pipe(Effect.provide(githubLayer)),
);
