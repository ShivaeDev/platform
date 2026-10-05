import assert from "node:assert/strict";
import { test as it } from "node:test";
import { balancedShards, parseShard } from "./shard.ts";

it("shards accept arbitrary counts and reject malformed or out-of-range selections", () => {
	assert.deepEqual(parseShard("3/7"), { count: 7, index: 3 });
	for (const value of ["0/4", "5/4", "1/0", "-1/4", "1.5/4", "1", "1/4/2", "9007199254740992/9007199254740992"]) {
		assert.throws(() => parseShard(value));
	}
});

it("balancing covers every package once, includes new packages, and is independent of discovery order", () => {
	const packages = [
		{ name: "large", seconds: 20 },
		{ name: "small-a", seconds: 5 },
		{ name: "small-b", seconds: 5 },
		{ name: "new-package", seconds: 6 },
	];
	for (const count of [1, 2, 4, 8]) {
		const groups = balancedShards(
			packages,
			count,
			(item) => item.name,
			(item) => item.seconds,
		);
		assert.equal(groups.length, count);
		assert.deepEqual(
			groups
				.flat()
				.map((item) => item.name)
				.sort((a, b) => a.localeCompare(b, "en")),
			packages.map((item) => item.name).sort((a, b) => a.localeCompare(b, "en")),
		);
		assert.deepEqual(
			groups,
			balancedShards(
				[...packages].reverse(),
				count,
				(item) => item.name,
				(item) => item.seconds,
			),
		);
	}
	const groups = balancedShards(
		packages,
		2,
		(item) => item.name,
		(item) => item.seconds,
	);
	assert.deepEqual(
		groups.map((group) => group.reduce((sum, item) => sum + item.seconds, 0)),
		[20, 16],
	);
});
