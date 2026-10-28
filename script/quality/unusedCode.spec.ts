import { expect } from "vitest";
import {
	compiledImports,
	dependencyDebt,
	exceptionRequested,
	nativeSuppressions,
	optionsRequested,
	providedDependency,
	sourceImports,
	unusedRepository,
} from "#quality/test-support/unusedRepository.ts";

unusedRepository.it(
	"reports unused files and exports while keeping exact and wildcard public API, bins, stories and spec helpers",
	[],
	function* ({ cli }) {
		const result = yield* cli("lint");
		const exitCode = result.status;
		expect(exitCode).toBe(1);
		expect(result.stdout).toContain("error code/unused");
		expect(result.stdout).toContain("packages/app/src/orphan.ts");
		expect(result.stdout).toContain("Unused export. Remove the export or use it from an entry point: unused");
		expect(result.stdout).toContain("Unused exported type. Remove the export or use it from an entry point: Unused");
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
	const exitCode = result.status;
	expect(exitCode).toBe(1);
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

unusedRepository.it("counts imports through the application's declared dependency entry point", [providedDependency], function* ({ cli }) {
	const result = yield* cli("lint");
	expect(result.stdout).toContain("error code/unused");
	expect(result.stdout).not.toContain("Unused dependency. Remove it from the package manifest if it is no longer needed: @shivaedev/platform");
	expect(result.stdout).not.toContain("Missing package dependency. Declare it in the importing package's manifest: @demo/component");
});

unusedRepository.it("refuses a permanent exception while keeping the unused file visible", [exceptionRequested], function* ({ cli }) {
	const result = yield* cli("lint");
	const exitCode = result.status;
	expect(exitCode).toBe(1);
	expect(result.stdout).toContain("names a rule that takes no exceptions");
	expect(result.stdout).toContain("Unused file. Remove it or reach it from a declared entry point: packages/app/src/orphan.ts");
});

unusedRepository.it("refuses options that would hide unused code", [optionsRequested], function* ({ cli }) {
	const result = yield* cli("lint");
	const exitCode = result.status;
	expect(exitCode).toBe(2);
	expect(result.stderr).toContain("this rule takes no options");
});

unusedRepository.it("keeps manifest Knip suppressions from hiding Quality findings", [dependencyDebt, nativeSuppressions], function* ({ cli }) {
	const result = yield* cli("lint");
	const exitCode = result.status;
	expect(exitCode).toBe(1);
	expect(result.stdout).toContain("Unused file. Remove it or reach it from a declared entry point: packages/app/src/orphan.ts");
	expect(result.stdout).toContain("Unused export. Remove the export or use it from an entry point: unused");
	expect(result.stdout).toContain("Unused dependency. Remove it from the package manifest if it is no longer needed: left-pad");
	expect(result.stdout).toContain("Missing package dependency. Declare it in the importing package's manifest: missing-package");
});

unusedRepository.it("follows source-conditioned import aliases before the package is built", [sourceImports], function* ({ cli }) {
	const result = yield* cli("lint");
	expect(result.stdout).toContain("packages/app/src/aliased.tsx:2  Unused export. Remove the export or use it from an entry point: unused.");
	expect(result.stdout).not.toContain("Unused file. Remove it or reach it from a declared entry point: packages/app/src/aliased.tsx");
});

unusedRepository.it(
	"follows source imports after a compiler build without counting emitted files as source",
	[sourceImports, compiledImports],
	function* ({ cli }) {
		const result = yield* cli("lint");
		expect(result.stdout).toContain("packages/app/src/aliased.tsx:2  Unused export. Remove the export or use it from an entry point: unused.");
		expect(result.stdout).not.toContain("Unused file. Remove it or reach it from a declared entry point: packages/app/src/aliased.tsx");
		expect(result.stdout).not.toContain("Unused file. Remove it or reach it from a declared entry point: packages/app/dist/");
	},
);
