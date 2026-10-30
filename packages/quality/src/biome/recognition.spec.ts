import { afterEach, describe, expect, it } from "vitest";
import { biomeReport } from "#biome/report.ts";
import { RECOGNITION_ARGS, RECOGNITION_RULES, recognitionSources, recognitionTree } from "#test/biomeRecognition.ts";
import { run } from "#test/run.ts";
import { removeSeededTrees } from "#test/tree.ts";

afterEach(removeSeededTrees);

describe("Biome diagnostic recognition", () => {
	it("corrects proven non-test and non-component shapes while retaining nearby violations", async () => {
		const root = recognitionTree();
		const before = recognitionSources(root);
		const report = await run(biomeReport(root, RECOGNITION_ARGS));
		const found = report.diagnostics.map((diagnostic) => [diagnostic.location.path, diagnostic.location.start?.line, diagnostic.category]);
		expect(found.map((finding) => JSON.stringify(finding)).toSorted()).toEqual(
			[
				["src/regex.test.ts", 2, "lint/nursery/useValidTestTitle"],
				["src/regex.test.ts", 3, "lint/nursery/useValidTestTitle"],
				["src/regex.test.ts", 4, "lint/nursery/useValidTestTitle"],
				["src/generators.test.ts", 4, "lint/style/noDoneCallback"],
				["src/generators.test.ts", 5, "lint/style/noDoneCallback"],
				["src/generators.test.ts", 6, "lint/style/noDoneCallback"],
				["src/generators.test.ts", 7, "lint/nursery/useValidTestTitle"],
				["src/generators.test.ts", 8, "lint/style/noDoneCallback"],
				["src/tags.tsx", 7, "lint/correctness/noComponentHookFactories"],
				["src/tags.tsx", 8, "lint/correctness/noComponentHookFactories"],
				["src/tags.tsx", 9, "lint/correctness/noComponentHookFactories"],
				["src/tags.tsx", 10, "lint/correctness/noComponentHookFactories"],
				["src/tags.tsx", 10, "lint/correctness/noComponentHookFactories"],
				["src/tags.tsx", 12, "lint/correctness/noComponentHookFactories"],
				["src/tags.tsx", 13, "lint/correctness/noComponentHookFactories"],
				["src/fake-tags.tsx", 2, "lint/correctness/noComponentHookFactories"],
			]
				.map((finding) => JSON.stringify(finding))
				.toSorted((left, right) => left.localeCompare(right)),
		);
		expect(recognitionSources(root)).toEqual(before);
	});

	it("applies the same recognition to a full preset check", async () => {
		const root = recognitionTree();
		const lint = await run(biomeReport(root, RECOGNITION_ARGS));
		const check = await run(biomeReport(root, ["check"]));
		const relevant = check.diagnostics.filter((diagnostic) => RECOGNITION_RULES.includes(diagnostic.category ?? ""));
		expect(relevant.map((diagnostic) => JSON.stringify(diagnostic)).toSorted()).toEqual(
			lint.diagnostics.map((diagnostic) => JSON.stringify(diagnostic)).toSorted(),
		);
	});
});
