import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decodeTimingSnapshot } from "./timings.ts";

interface MainRun {
	conclusion: string;
	event: string;
	"head_branch": string;
	"head_sha": string;
	id: number;
}

export function mainShardPlan(repository: string, main: boolean, github: (args: string[]) => string) {
	const fallback = { artifactId: "", count: main ? 1 : 8, runId: "" };
	const selected = { consumers: { ...fallback }, tests: { ...fallback } };
	if (main) {
		return selected;
	}
	const temporary = mkdtempSync(join(tmpdir(), "platform-shard-plan-"));
	try {
		const { "workflow_runs": runs }: { "workflow_runs": MainRun[] } = JSON.parse(
			github(["api", `repos/${repository}/actions/workflows/ci.yml/runs?branch=main&event=push&status=success&per_page=10`]),
		);
		for (const kind of ["tests", "consumers"] as const) {
			const artifact = kind === "tests" ? "test-balancing" : "consumer-balancing";
			const file = kind === "tests" ? "test-durations.json" : "consumer-durations.json";
			selected[kind] = findSnapshot(repository, runs, artifact, file, temporary, github) ?? fallback;
		}
	} catch {
		// Forks and new repositories may not have access to main artifacts.
	} finally {
		rmSync(temporary, { force: true, recursive: true });
	}
	return selected;
}

function findSnapshot(
	repository: string,
	runs: readonly MainRun[],
	artifact: string,
	file: string,
	temporary: string,
	github: (args: string[]) => string,
) {
	for (const run of runs) {
		if (run.event !== "push" || run.head_branch !== "main" || run.conclusion !== "success") {
			continue;
		}
		try {
			const snapshot = readSnapshot(repository, run, artifact, file, temporary, github);
			if (snapshot !== undefined) {
				return { artifactId: String(snapshot.artifactId), count: snapshot.shardCount ?? 8, runId: String(run.id) };
			}
		} catch {
			// A missing or unreadable snapshot must not prevent checking the PR.
		}
	}
	return undefined;
}

function readSnapshot(repository: string, run: MainRun, artifact: string, file: string, temporary: string, github: (args: string[]) => string) {
	const artifactId = mainArtifact(repository, run.id, artifact, github);
	if (artifactId === undefined) {
		return undefined;
	}
	const directory = join(temporary, `${artifact}-${run.id}`);
	github(["run", "download", String(run.id), "--repo", repository, "--name", artifact, "--dir", directory]);
	const snapshot = decodeTimingSnapshot(JSON.parse(readFileSync(join(directory, file), "utf8")));
	return snapshot.runId === String(run.id)
		&& snapshot.sha === run.head_sha
		&& snapshot.timings.length > 0
		&& mainArtifact(repository, run.id, artifact, github) === artifactId
		? { ...snapshot, artifactId }
		: undefined;
}

function mainArtifact(repository: string, runId: number, name: string, github: (args: string[]) => string) {
	const { artifacts }: { artifacts: { id: number; name: string; expired: boolean }[] } = JSON.parse(
		github(["api", `repos/${repository}/actions/runs/${runId}/artifacts?name=${name}`]),
	);
	const artifact = artifacts.find((item) => item.name === name && !item.expired);
	return artifact !== undefined && Number.isSafeInteger(artifact.id) && artifact.id > 0 ? artifact.id : undefined;
}
