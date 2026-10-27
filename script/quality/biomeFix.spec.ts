import { expect } from "vitest";
import { indexOfComparison, qualityKit } from "#quality/test-support/kit.ts";

for (const formatter of ["quality fix", "biome check --write --unsafe"] as const) {
	qualityKit.it(
		`${formatter} leaves indexOf comparisons for the author while lint still reports useIncludes`,
		[indexOfComparison],
		function* ({ fix, biomeWrite, lint, read }) {
			const original = read("src/contains.ts");
			const result = yield* formatter === "quality fix" ? fix() : biomeWrite();
			expect(read("src/contains.ts")).toBe(original);
			expect(result.status).toBe(formatter === "quality fix" ? 0 : 1);
			const finding = yield* lint();
			expect(finding.status).toBe(1);
			expect(finding.stdout).toContain("error biome/lint/nursery/useIncludes (1)\n  src/contains.ts:2");
		},
	);
}
