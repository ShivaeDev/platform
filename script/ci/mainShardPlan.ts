import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Cause, Effect, Schema } from "effect";
import { read } from "@shivaedev/github/read.ts";
import { decodeTimingSnapshot } from "#ci/timings.ts";

const MainRun = Schema.Struct({
	conclusion: Schema.NullOr(Schema.String),
	event: Schema.String,
	headBranch: Schema.String,
	headSha: Schema.String,
	id: Schema.Number,
}).pipe(Schema.encodeKeys({ headBranch: "head_branch", headSha: "head_sha" }));
const Runs = Schema.Struct({ workflowRuns: Schema.Array(MainRun) }).pipe(Schema.encodeKeys({ workflowRuns: "workflow_runs" }));
const Artifacts = Schema.Struct({ artifacts: Schema.Array(Schema.Struct({ expired: Schema.Boolean, id: Schema.Number, name: Schema.String })) });
const MINIMUM_TEST_SHARDS = 4;

export const mainShardPlan = Effect.fn("CI.mainShardPlan")(function* (repository: string, download: (args: string[]) => string) {
	const fallback = { artifactId: "", count: 8, runId: "" };
	const selected = { consumers: { ...fallback }, tests: { ...fallback, count: 25 } };
	const temporary = yield* Effect.acquireRelease(
		Effect.try(() => mkdtempSync(join(tmpdir(), "platform-shard-plan-"))),
		(directory) => Effect.sync(() => rmSync(directory, { force: true, recursive: true })),
	);
	yield* Effect.gen(function* () {
		const { workflowRuns: runs } = yield* read(
			`/repos/${repository}/actions/workflows/ci.yml/runs?event=merge_group&status=success&per_page=10`,
			Runs,
		);
		for (const kind of ["tests", "consumers"] as const) {
			const artifact = kind === "tests" ? "test-balancing" : "consumer-balancing";
			const file = kind === "tests" ? "test-durations.json" : "consumer-durations.json";
			selected[kind] = (yield* findSnapshot(repository, runs, artifact, file, temporary, download)) ?? selected[kind];
		}
	}).pipe(
		Effect.timeout("15 seconds"),
		Effect.catchCause((cause) =>
			Effect.logWarning(
				"Cannot read merge-queue timing snapshots; using 25 test shards and eight consumer shards for unavailable plans",
				Cause.pretty(cause),
			),
		),
	);
	return { consumers: selected.consumers, tests: { ...selected.tests, count: Math.max(MINIMUM_TEST_SHARDS, selected.tests.count) } };
});

const findSnapshot = Effect.fn("CI.findSnapshot")(function* (
	repository: string,
	runs: readonly (typeof MainRun.Type)[],
	artifact: string,
	file: string,
	temporary: string,
	download: (args: string[]) => string,
) {
	for (const run of runs) {
		if (run.event !== "merge_group" || !run.headBranch.startsWith("gh-readonly-queue/main/") || run.conclusion !== "success") {
			continue;
		}
		const snapshot = yield* readSnapshot(repository, run, artifact, file, temporary, download).pipe(
			Effect.catchCause((cause) =>
				Effect.as(
					Effect.logWarning(`Cannot read ${artifact} snapshot from run ${run.id}; trying older snapshots before the fallback`, Cause.pretty(cause)),
					undefined,
				),
			),
		);
		if (snapshot !== undefined) {
			return { artifactId: String(snapshot.artifactId), count: snapshot.shardCount ?? 8, runId: String(run.id) };
		}
	}
	return undefined;
});

const readSnapshot = Effect.fn("CI.readSnapshot")(function* (
	repository: string,
	run: typeof MainRun.Type,
	artifact: string,
	file: string,
	temporary: string,
	download: (args: string[]) => string,
) {
	const artifactId = yield* mainArtifact(repository, run.id, artifact);
	if (artifactId === undefined) {
		return undefined;
	}
	const directory = join(temporary, `${artifact}-${run.id}`);
	yield* Effect.try(() => download(["run", "download", String(run.id), "--repo", repository, "--name", artifact, "--dir", directory]));
	const snapshot = yield* Effect.try(() => decodeTimingSnapshot(JSON.parse(readFileSync(join(directory, file), "utf8"))));
	return snapshot.runId === String(run.id)
		&& snapshot.sha === run.headSha
		&& snapshot.timings.length > 0
		&& (yield* mainArtifact(repository, run.id, artifact)) === artifactId
		? { ...snapshot, artifactId }
		: undefined;
});

const mainArtifact = Effect.fn("CI.mainArtifact")(function* (repository: string, runId: number, name: string) {
	const { artifacts } = yield* read(`/repos/${repository}/actions/runs/${runId}/artifacts?name=${name}`, Artifacts);
	const artifact = artifacts.find((item) => item.name === name && !item.expired);
	return artifact !== undefined && Number.isSafeInteger(artifact.id) && artifact.id > 0 ? artifact.id : undefined;
});
