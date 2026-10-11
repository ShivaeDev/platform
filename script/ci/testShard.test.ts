import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test as it } from "node:test";
import { freshRerunFixture } from "#ci/test-support/freshRerunFixture.ts";
import { readAttempt } from "./freshReports.ts";

it("recovers module state in a fresh process without rerunning passing tests, and retains complete artifacts", () => {
	const fixture = freshRerunFixture();
	try {
		const result = fixture.run("merge_group", ["--coverage", "--shard=1/1"]);
		assert.equal(result.status, 0, result.stdout + result.stderr);
		assert.equal(fixture.read("attempts.txt"), "attempt\nattempt\n");
		assert.equal(fixture.read("passed.txt"), "passed\n");
		assert.equal(fixture.read("other-passed.txt"), "passed\n");
		const first = JSON.parse(fixture.read(".ci/tests.first.json"));
		const snapshot = readAttempt(join(fixture.root, ".ci/tests.first.bin"));
		for (const file of snapshot.files) {
			assert.equal(first.testResults.find((item: { name: string }) => item.name === file.filepath).durationMs, file.result?.duration ?? 0);
		}
		const final = JSON.parse(fixture.read(".ci/tests.json"));
		assert.equal(first.numFailedTests, 1);
		assert.equal(final.numPassedTests, 3);
		assert.equal(final.numFailedTests, 0);
		const rerun = JSON.parse(fixture.read(".ci/tests.rerun.json"));
		const original = first.testResults.find((file: { name: string }) => file.name.endsWith("fresh.spec.ts"));
		const combined = final.testResults.find((file: { name: string }) => file.name.endsWith("fresh.spec.ts"));
		assert.equal(combined.durationMs, original.durationMs + rerun.testResults[0].durationMs);
		assert.match(fixture.read(".ci/tests.junit.xml"), /tests="3" failures="0"/u);
		assert.match(fixture.read(".ci/summary.md"), /Flaky:.*recovers only in a fresh process/u);
		const coverage = fixture.read(".ci/coverage/lcov.info");
		for (const file of ["passing.ts", "recovered.ts"]) {
			assert.match(coverage, new RegExp(`SF:.*${file}\\n[\\s\\S]*?DA:1,1`, "u"));
		}
		assert.ok(existsSync(join(fixture.root, ".ci/vite/vitest")));
	} finally {
		fixture.close();
	}
});

for (const event of ["pull_request", "push"]) {
	it(`${event} fails on the first attempt without a rerun`, () => {
		const fixture = freshRerunFixture();
		try {
			const result = fixture.run(event);
			assert.equal(result.status, 1, result.stdout + result.stderr);
			assert.equal(fixture.read("attempts.txt"), "attempt\n");
			assert.equal(existsSync(join(fixture.root, ".ci/tests.rerun.json")), false);
		} finally {
			fixture.close();
		}
	});
}

it("runs a passing queue shard once and removes reports from a previous invocation", () => {
	const fixture = freshRerunFixture();
	try {
		fixture.write("attempted.txt", "already attempted");
		fixture.write(".ci/tests.rerun.json", "stale");
		const result = fixture.run("merge_group");
		assert.equal(result.status, 0, result.stdout + result.stderr);
		assert.equal(fixture.read("attempts.txt"), "attempt\n");
		assert.equal(existsSync(join(fixture.root, ".ci/tests.rerun.json")), false);
	} finally {
		fixture.close();
	}
});

it("does not recover unhandled errors with a test rerun", () => {
	const fixture = freshRerunFixture();
	try {
		fixture.write("passing.spec.ts", "throw new Error('fixture fails collection');");
		fixture.write(
			"fresh.spec.ts",
			fixture.read("fresh.spec.ts")
				+ "\nit('unhandled', async () => { setTimeout(() => { throw new Error('unhandled fixture error'); }, 0); await new Promise(resolve => setTimeout(resolve, 25)); });",
		);
		const result = fixture.run("merge_group");
		assert.equal(result.status, 1, result.stdout + result.stderr);
		assert.equal(fixture.read("attempts.txt"), "attempt\n");
		assert.equal(existsSync(join(fixture.root, ".ci/tests.rerun.json")), false);
	} finally {
		fixture.close();
	}
});

it("recovers a collection failure and lists the file as flaky", () => {
	const fixture = freshRerunFixture();
	try {
		fixture.write("attempted.txt", "already attempted");
		fixture.write(
			"passing.spec.ts",
			fixture.read("passing.spec.ts").replace(
				"it('passes",
				`import { existsSync, writeFileSync } from 'node:fs';
			if (!existsSync('collected.txt')) { writeFileSync('collected.txt', 'failed'); throw new Error('collection fixture failure'); }
			it('passes`,
			),
		);
		const result = fixture.run("merge_group");
		assert.equal(result.status, 0, result.stdout + result.stderr);
		assert.equal(fixture.read("attempts.txt"), "attempt\n");
		assert.equal(fixture.read("other-passed.txt"), "passed\n");
		assert.equal(JSON.parse(fixture.read(".ci/tests.json")).numPassedTests, 3);
		assert.match(fixture.read(".ci/summary.md"), /Flaky:.*collection failure/u);
	} finally {
		fixture.close();
	}
});

it("reruns only the failed project when projects share a file path", () => {
	const fixture = freshRerunFixture();
	try {
		fixture.write(
			"vitest.config.ts",
			fixture.read("vitest.config.ts").replace(
				"include: ['*.spec.ts'],",
				`projects: [
			{ extends: true, test: { name: 'failed', include: ['*.spec.ts'], env: { PROJECT: 'failed' } } },
			{ extends: true, test: { name: 'passed', include: ['*.spec.ts'], env: { PROJECT: 'passed' } } }
		],`,
			),
		);
		fixture.write(
			"fresh.spec.ts",
			fixture.read("fresh.spec.ts").replace(
				"expect(poisoned)",
				`if (process.env.PROJECT === 'passed') { appendFileSync('project-passed.txt', 'passed\\n'); return; }
			expect(poisoned)`,
			),
		);
		const result = fixture.run("merge_group");
		assert.equal(result.status, 0, result.stdout + result.stderr);
		assert.equal(fixture.read("attempts.txt"), "attempt\nattempt\n");
		assert.equal(fixture.read("project-passed.txt"), "passed\n");
		assert.equal(fixture.read("passed.txt"), "passed\npassed\n");
		assert.equal(fixture.read("other-passed.txt"), "passed\npassed\n");
		assert.equal(JSON.parse(fixture.read(".ci/tests.json")).numPassedTests, 6);
	} finally {
		fixture.close();
	}
});

it("fails the shard after one unsuccessful fresh rerun", () => {
	const fixture = freshRerunFixture();
	try {
		const result = fixture.run("merge_group", [], true);
		assert.equal(result.status, 1, result.stdout + result.stderr);
		assert.equal(fixture.read("attempts.txt"), "attempt\nattempt\n");
		assert.equal(JSON.parse(fixture.read(".ci/tests.json")).numFailedTests, 1);
	} finally {
		fixture.close();
	}
});
