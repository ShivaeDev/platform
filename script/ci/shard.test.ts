import assert from "node:assert/strict";
import { planning } from "#ci/test-support/planning.ts";

planning.it("shards accept arbitrary counts and reject malformed or out-of-range selections", [], ({ parseShard }) => {
	assert.deepEqual(parseShard("3/7"), { count: 7, index: 3 });
	for (const value of ["0/4", "5/4", "1/0", "-1/4", "1.5/4", "1", "1/4/2", "9007199254740992/9007199254740992"]) {
		assert.throws(() => parseShard(value));
	}
});

planning.it("balancing covers every package once, includes new packages, and is independent of discovery order", [], ({ planShards }) => {
	const packages = [
		{ name: "large", seconds: 20 },
		{ name: "small-a", seconds: 5 },
		{ name: "small-b", seconds: 5 },
		{ name: "new-package", seconds: 6 },
	];
	for (const count of [1, 2, 4, 8]) {
		const groups = planShards(packages, count);
		assert.equal(groups.length, count);
		assert.deepEqual(
			groups
				.flat()
				.map((item) => item.name)
				.sort((a, b) => a.localeCompare(b, "en")),
			packages.map((item) => item.name).sort((a, b) => a.localeCompare(b, "en")),
		);
		assert.deepEqual(groups, planShards([...packages].reverse(), count));
	}
	const groups = planShards(packages, 2);
	assert.deepEqual(
		groups.map((group) => group.reduce((sum, item) => sum + item.seconds, 0)),
		[20, 16],
	);
});
