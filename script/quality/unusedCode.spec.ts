import { expect } from "vitest";
import { dependencyDebt, unusedRepository } from "#quality/test-support/unusedRepository.ts";

unusedRepository.it(
	"reports unused files and exports while keeping exact and wildcard public API, bins, stories and spec helpers",
	[],
	function* ({ cli }) {
		const result = yield* cli("lint");
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("error code/unused");
		expect(result.stdout).toContain("packages/app/src/orphan.ts");
		expect(result.stdout).toContain("Unused export. Remove the export or use it from an entry point: unused");
		expect(result.stdout).not.toContain("Unused file. Remove it or reach it from a declared entry point: packages/library/src/publicValue.ts");
		expect(result.stdout).not.toContain("Unused export. Remove the export or use it from an entry point: publicValue");
		expect(result.stdout).not.toContain("Unused export. Remove the export or use it from an entry point: helper");
		expect(result.stdout).not.toContain("Unused file. Remove it or reach it from a declared entry point: packages/exact/src/publicValue.ts");
		expect(result.stdout).not.toContain("Unused file. Remove it or reach it from a declared entry point: packages/app/src/launch.ts");
		expect(result.stdout).not.toContain("Unused file. Remove it or reach it from a declared entry point: packages/app/src/view.stories.ts");
		expect(result.stdout).not.toContain("Unused file. Remove it or reach it from a declared entry point: packages/app/src/test-support/helper.ts");
	},
);

unusedRepository.it("reports unused and missing package dependencies in workspace members", [dependencyDebt], function* ({ cli }) {
	const result = yield* cli("lint");
	expect(result.status).toBe(1);
	expect(result.stdout).toContain("Unused dependency. Remove it from the package manifest if it is no longer needed: left-pad");
	expect(result.stdout).toContain("Missing package dependency. Declare it in the importing package's manifest: missing-package");
});

unusedRepository.it("passes with existing findings recorded by the normal baseline command", [], function* ({ cli, read }) {
	const recorded = yield* cli("baseline", "write");
	expect(recorded.status).toBe(0);
	expect(read("packages/app/quality-baseline.jsonl")).toContain('"rule":"code/unused"');
	const result = yield* cli("lint");
	expect(result.status).toBe(0);
	expect(result.stdout).toContain("quality: passed.");
});
