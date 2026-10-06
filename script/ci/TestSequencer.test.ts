import assert from "node:assert/strict";
import { test as it } from "node:test";
import type { TestSpecification } from "vitest/node";
import { vitestWorkspace } from "#ci/test-support/vitestWorkspace.ts";

it("balances real Vitest specifications, includes new files, and distinguishes projects sharing a file", async () => {
	const workspace = await vitestWorkspace();
	const { vitest, sequencer } = workspace;
	try {
		const files = await vitest.globTestSpecifications();
		assert.equal(files.length, 5);
		const snapshot = {
			runId: "42",
			sha: "main-sha",
			timings: [
				{ durationMs: 20_000, name: "fixture:unit:heavy.test.ts" },
				{ durationMs: 15_000, name: "fixture:dom:shared.test.ts" },
				{ durationMs: 5000, name: "fixture:unit:shared.test.ts" },
			],
		};
		for (const measured of [false, true]) {
			if (measured) {
				workspace.withTimings(snapshot);
			}
			for (const count of [1, 2, 8]) {
				const groups: TestSpecification[][] = [];
				for (let index = 1; index <= count; index += 1) {
					vitest.config.shard = { count, index };
					const group = await sequencer.shard(files);
					assert.deepEqual(group, await sequencer.shard([...files].reverse()));
					groups.push(group);
				}
				assert.deepEqual(
					groups
						.flat()
						.map((file) => sequencer.name(file))
						.sort((a, b) => a.localeCompare(b, "en")),
					files.map((file) => sequencer.name(file)).sort((a, b) => a.localeCompare(b, "en")),
				);
				if (measured && count === 2) {
					const estimates = sequencer.estimates();
					const totals = groups.map((group) => group.reduce((sum, file) => sum + (estimates[sequencer.name(file)] ?? 1000), 0));
					assert.deepEqual(totals, [21_000, 21_000]);
				}
			}
		}
	} finally {
		await workspace.close();
	}
});
