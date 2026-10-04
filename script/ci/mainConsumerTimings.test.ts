import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test as it } from "node:test";
import { decodeConsumerTimingSnapshot } from "./consumerTimings.ts";

it("loads a successful main snapshot once, rejects wrong provenance, and falls back without timing access", () => {
	const root = mkdtempSync(join(tmpdir(), "platform-timing-fetch-"));
	const fixture = join(root, "fixture.json");
	const output = join(root, "output.json");
	const bin = join(root, "bin");
	mkdirSync(bin);
	writeFileSync(
		join(bin, "gh"),
		[
			"#!/usr/bin/env node",
			"import { copyFileSync, readFileSync } from 'node:fs';",
			`const fixture = ${JSON.stringify(fixture)};`,
			"const data = JSON.parse(readFileSync(fixture, 'utf8'));",
			"const args = process.argv.slice(2);",
			"if (data.deny) process.exit(1);",
			"if (args[0] === 'api' && args[1].includes('workflows/ci.yml/runs?')) {",
			" process.stdout.write(JSON.stringify({ workflow_runs: data.runs }));",
			"} else if (args[0] === 'api') {",
			" process.stdout.write(JSON.stringify({ artifacts: [{ name: 'consumer-balancing', expired: args[1].includes('/43/') }] }));",
			"} else {",
			" const directory = args[args.indexOf('--dir') + 1];",
			" copyFileSync(fixture, directory + '/consumer-durations.json');",
			"}",
		].join("\n"),
		{ mode: 0o755 },
	);
	function fetch(data: unknown) {
		writeFileSync(fixture, JSON.stringify(data));
		const result = spawnSync(process.execPath, ["--conditions=source", resolve("script/ci/mainConsumerTimings.ts"), output], {
			encoding: "utf8",
			env: { "GITHUB_REPOSITORY": "owner/repo", "PATH": `${bin}:${dirname(process.execPath)}:/usr/bin:/bin` },
			timeout: 20_000,
		});
		assert.equal(result.status, 0, result.stderr);
		return decodeConsumerTimingSnapshot(JSON.parse(readFileSync(output, "utf8")));
	}
	const snapshot = { runId: "42", sha: "main-sha", timings: [{ durationMs: 12_000, name: "sample" }] };
	const runs = [
		{ conclusion: "success", event: "pull_request", "head_branch": "feature", "head_sha": "pr-sha", id: 44 },
		{ conclusion: "success", event: "push", "head_branch": "main", "head_sha": "expired-sha", id: 43 },
		{ conclusion: "success", event: "push", "head_branch": "main", "head_sha": "main-sha", id: 42 },
	];
	try {
		assert.deepEqual(fetch({ ...snapshot, runs }), snapshot);
		assert.deepEqual(fetch({ ...snapshot, runs, sha: "pr-sha" }).timings, []);
		assert.deepEqual(fetch({ ...snapshot, deny: true, runs }).timings, []);
		assert.deepEqual(fetch({ ...snapshot, runs: [] }).timings, []);
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});
