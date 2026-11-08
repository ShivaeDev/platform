import { expect } from "vitest";
import { planning } from "#ci/test-support/planning.ts";

planning.it("shards accept arbitrary counts and reject malformed or out-of-range selections", [], ({ parseShard }) => {
	expect(parseShard("3/7")).toEqual({ count: 7, index: 3 });
	for (const value of ["0/4", "5/4", "1/0", "-1/4", "1.5/4", "1", "1/4/2", "9007199254740992/9007199254740992"]) {
		expect(() => parseShard(value)).toThrow();
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
		expect(groups.length).toBe(count);
		expect(
			groups
				.flat()
				.map((item) => item.name)
				.sort((a, b) => a.localeCompare(b, "en")),
		).toEqual(packages.map((item) => item.name).sort((a, b) => a.localeCompare(b, "en")));
		expect(groups).toEqual(planShards([...packages].reverse(), count));
	}
	const groups = planShards(packages, 2);
	expect(groups.map((group) => group.reduce((sum, item) => sum + item.seconds, 0))).toEqual([20, 16]);
});
