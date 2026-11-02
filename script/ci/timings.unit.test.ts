import assert from "node:assert/strict";
import { it } from "vitest";
import { decodeTestTimingReport } from "./timings.ts";

it("decodes portable project identities and total attempt durations from final reports", () => {
	const report = {
		testResults: [
			{ durationMs: 5000, projectName: "quality:dom", relativePath: "packages/quality/src/cli.test.ts" },
			{ durationMs: 20_000, projectName: "quality:unit", relativePath: "packages/quality/src/cli.test.ts" },
			{ durationMs: 0, projectName: "quality:unit", relativePath: "packages/quality/src/empty.test.ts" },
		],
	};
	assert.deepEqual(decodeTestTimingReport(JSON.stringify(report)), [
		{ durationMs: 5000, name: "quality:dom:packages/quality/src/cli.test.ts" },
		{ durationMs: 20_000, name: "quality:unit:packages/quality/src/cli.test.ts" },
		{ durationMs: 1, name: "quality:unit:packages/quality/src/empty.test.ts" },
	]);
});

it("rejects reports without final file results", () => {
	for (const report of [null, [], {}, { testResults: {} }]) {
		assert.throws(() => decodeTestTimingReport(JSON.stringify(report)), /Invalid test timing report/u);
	}
});

it("rejects missing file identities and invalid durations", () => {
	const file = { durationMs: 10, projectName: "unit", relativePath: "sample.test.ts" };
	for (const fields of [{ durationMs: null }, { durationMs: -1 }, { projectName: null }, { relativePath: null }, { relativePath: "" }]) {
		assert.throws(() => decodeTestTimingReport(JSON.stringify({ testResults: [{ ...file, ...fields }] })), /Invalid test timing/u);
	}
});
