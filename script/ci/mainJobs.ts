import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Config, Console, Effect, Schema } from "effect";
import { QueueJobs, queueJobTimings } from "#ci/queueJobTimings.ts";
import { githubLayer } from "#lib/githubLayer.ts";

NodeRuntime.runMain(
	Effect.gen(function* () {
		const repository = yield* Config.String("GITHUB_REPOSITORY");
		const runId = yield* Config.String("GITHUB_RUN_ID");
		const jobs = yield* queueJobTimings(repository, runId);
		yield* Console.log(yield* Schema.encodeEffect(Schema.fromJsonString(QueueJobs))(jobs));
	}).pipe(Effect.provide(githubLayer)),
);
