import { resolve } from "node:path";
import process from "node:process";
import { NodeFileSystem, NodeRuntime } from "@effect/platform-node";
import { Config, Console, Effect, FileSystem, Schema } from "effect";
import { decodeTimingSnapshot, type TimingSnapshot } from "#ci/timings.ts";
import { command, writeJson } from "#package-check/io.ts";

const Runs = Schema.Struct({
	workflowRuns: Schema.Array(
		Schema.Struct({ conclusion: Schema.String, event: Schema.String, headBranch: Schema.String, headSha: Schema.String, id: Schema.Number }).pipe(
			Schema.encodeKeys({ headBranch: "head_branch", headSha: "head_sha" }),
		),
	),
}).pipe(Schema.encodeKeys({ workflowRuns: "workflow_runs" }));
const Artifacts = Schema.Struct({ artifacts: Schema.Array(Schema.Struct({ expired: Schema.Boolean, name: Schema.String })) });
const decodeRuns = Schema.decodeUnknownSync(Schema.fromJsonString(Runs));
const decodeArtifacts = Schema.decodeUnknownSync(Schema.fromJsonString(Artifacts));

function mainSnapshot() {
	return Effect.gen(function* () {
		const repository = yield* Config.string("GITHUB_REPOSITORY");
		const root = process.cwd();
		const fs = yield* FileSystem.FileSystem;
		const runs = decodeRuns(
			yield* command(root, "gh", ["api", `repos/${repository}/actions/workflows/ci.yml/runs?branch=main&event=push&status=success&per_page=10`]),
		);
		for (const run of runs.workflowRuns) {
			if (run.event !== "push" || run.headBranch !== "main" || run.conclusion !== "success") {
				continue;
			}
			const artifacts = decodeArtifacts(
				yield* command(root, "gh", ["api", `repos/${repository}/actions/runs/${run.id}/artifacts?name=consumer-balancing`]),
			);
			if (!artifacts.artifacts.some((artifact) => artifact.name === "consumer-balancing" && !artifact.expired)) {
				continue;
			}
			const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "platform-main-timings-" });
			yield* command(root, "gh", ["run", "download", String(run.id), "--repo", repository, "--name", "consumer-balancing", "--dir", temporary]);
			const snapshot = decodeTimingSnapshot(JSON.parse(yield* fs.readFileString(resolve(temporary, "consumer-durations.json"))));
			if (snapshot.runId !== String(run.id) || snapshot.sha !== run.headSha || snapshot.timings.length === 0) {
				throw new Error("Consumer timing snapshot does not match its successful main run");
			}
			yield* Console.log(`Balancing consumers with measured timings from main run ${run.id}`);
			return snapshot;
		}
		return undefined;
	});
}

const program = Effect.gen(function* () {
	const output = process.argv[2];
	if (output === undefined) {
		throw new Error("Provide the output snapshot path");
	}
	const snapshot = yield* mainSnapshot().pipe(
		Effect.timeout("10 seconds"),
		Effect.catchCause(() => Effect.as(Console.log("Main consumer timings unavailable; using equal weights"), undefined)),
	);
	const fallback: TimingSnapshot = { runId: "", sha: "", timings: [] };
	if (snapshot === undefined) {
		yield* Console.log("No successful main timing snapshot available; using equal weights");
	}
	yield* writeJson(output, snapshot ?? fallback);
});
NodeRuntime.runMain(program.pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer)));
