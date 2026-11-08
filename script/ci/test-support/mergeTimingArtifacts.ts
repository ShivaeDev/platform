import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Result } from "effect";
import type { Workspace } from "#ci/test-support/workspace.ts";
import { decodeTimingSnapshot } from "#ci/timings.ts";

export function mergeTimingArtifacts(engine: Workspace) {
	const { root } = engine.workspace;
	writeFileSync(join(root, "jobs.json"), JSON.stringify(engine.jobs));
	execFileSync(process.execPath, [
		"--conditions=@shivaedev/source",
		fileURLToPath(new URL("../mergeTestTimings.ts", import.meta.url)),
		"--directory",
		root,
		"--jobs",
		join(root, "jobs.json"),
		"--output",
		join(root, "snapshot.json"),
		"--count",
		"2",
		"--run-id",
		"42",
		"--sha",
		"main-sha",
		"--target-seconds",
		"240",
	]);
	return Result.getOrThrow(decodeTimingSnapshot(JSON.parse(readFileSync(join(root, "snapshot.json"), "utf8"))));
}
