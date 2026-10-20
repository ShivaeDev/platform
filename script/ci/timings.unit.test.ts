import assert from "node:assert/strict";
import { test as it } from "node:test";
import { decodeVitestTimingReport } from "./timings.ts";

it("decodes Vitest's project results cache into project-aware timings", () => {
	const report = {
		projects: {
			"quality:dom": { files: { "packages/quality/src/cli.test.ts": { duration: 5000, failed: false } } },
			"quality:unit": {
				files: {
					"packages/quality/src/cli.test.ts": { duration: 20_000, failed: false, lastRun: 1_792_454_400_000 },
					"packages/quality/src/empty.test.ts": { duration: 0, failed: false },
				},
			},
		},
		version: 1,
	};
	assert.deepEqual(decodeVitestTimingReport(JSON.stringify(report)), [
		{ durationMs: 5000, name: "quality:dom:packages/quality/src/cli.test.ts" },
		{ durationMs: 20_000, name: "quality:unit:packages/quality/src/cli.test.ts" },
		{ durationMs: 1, name: "quality:unit:packages/quality/src/empty.test.ts" },
	]);
});

it("rejects reports that are not Vitest results caches", () => {
	for (const report of [
		null,
		[],
		{},
		{ projects: {} },
		{ projects: {}, version: "1" },
		{ projects: [], version: 1 },
		{ projects: {}, version: 1 },
		{ projects: { unit: {} }, version: 1 },
		{ projects: { unit: { files: [] } }, version: 1 },
	]) {
		assert.throws(() => decodeVitestTimingReport(JSON.stringify(report)), /Invalid Vitest timing report/u);
	}
});

it("rejects failed tests and missing or invalid durations", () => {
	for (const result of [{ duration: 10, failed: true }, { failed: false }, { duration: -1, failed: false }]) {
		const report = { projects: { unit: { files: { "sample.test.ts": result } } }, version: 1 };
		assert.throws(() => decodeVitestTimingReport(JSON.stringify(report)), /Invalid successful test timing/u);
	}
});
