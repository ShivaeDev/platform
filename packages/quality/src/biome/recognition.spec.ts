import { Schema } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import { biomeReport } from "#biome/report.ts";
import { runBiome } from "#biome/run.ts";
import { RECOGNITION_ARGS, RECOGNITION_RULES, recognitionSources, recognitionTree } from "#test/biomeRecognition.ts";
import { removeSeededTrees } from "#test/tree.ts";

const RawReport = Schema.Struct({
	diagnostics: Schema.Array(
		Schema.Struct({
			category: Schema.String,
			location: Schema.Struct({ path: Schema.String, start: Schema.Struct({ line: Schema.Int }) }),
		}),
	),
});

afterEach(removeSeededTrees);

describe("Biome diagnostic recognition", () => {
	it("corrects proven non-test and non-component shapes while retaining nearby violations", async () => {
		const root = recognitionTree();
		const raw = await runBiome(root, [...RECOGNITION_ARGS, "--reporter=json", "--max-diagnostics=none", "."]);
		expect(raw.code).toBe(1);
		const original = Schema.decodeUnknownSync(Schema.fromJsonString(RawReport))(raw.stdout);
		expect(original.diagnostics.filter((diagnostic) => diagnostic.location.path === "src/regex.ts")).toHaveLength(3);
		expect(original.diagnostics.filter((diagnostic) => diagnostic.location.path === "src/generators.test.ts")).toHaveLength(8);
		expect(original.diagnostics.filter((diagnostic) => diagnostic.location.path === "src/tags.tsx")).toHaveLength(11);
		expect(original.diagnostics.filter((diagnostic) => diagnostic.location.path === "src/fake-tags.tsx")).toHaveLength(1);
		const before = recognitionSources(root);
		const report = await biomeReport(root, RECOGNITION_ARGS);
		const found = report.diagnostics.map((diagnostic) => [diagnostic.location.path, diagnostic.location.start?.line, diagnostic.category]);
		expect(found.map((finding) => JSON.stringify(finding)).toSorted()).toEqual(
			[
				["src/regex.ts", 2, "lint/nursery/useValidTestTitle"],
				["src/regex.ts", 3, "lint/nursery/useValidTestTitle"],
				["src/regex.ts", 4, "lint/nursery/useValidTestTitle"],
				["src/generators.test.ts", 4, "lint/style/noDoneCallback"],
				["src/generators.test.ts", 5, "lint/style/noDoneCallback"],
				["src/generators.test.ts", 6, "lint/style/noDoneCallback"],
				["src/generators.test.ts", 7, "lint/nursery/useValidTestTitle"],
				["src/generators.test.ts", 8, "lint/style/noDoneCallback"],
				["src/tags.tsx", 7, "lint/nursery/noComponentHookFactories"],
				["src/tags.tsx", 8, "lint/nursery/noComponentHookFactories"],
				["src/tags.tsx", 9, "lint/nursery/noComponentHookFactories"],
				["src/tags.tsx", 10, "lint/nursery/noComponentHookFactories"],
				["src/tags.tsx", 10, "lint/nursery/noComponentHookFactories"],
				["src/tags.tsx", 12, "lint/nursery/noComponentHookFactories"],
				["src/tags.tsx", 13, "lint/nursery/noComponentHookFactories"],
				["src/fake-tags.tsx", 2, "lint/nursery/noComponentHookFactories"],
			]
				.map((finding) => JSON.stringify(finding))
				.toSorted((left, right) => left.localeCompare(right)),
		);
		expect(recognitionSources(root)).toEqual(before);
	});

	it("applies the same recognition to a full preset check", async () => {
		const root = recognitionTree();
		const lint = await biomeReport(root, RECOGNITION_ARGS);
		const check = await biomeReport(root, ["check"]);
		const relevant = check.diagnostics.filter((diagnostic) => RECOGNITION_RULES.includes(diagnostic.category ?? ""));
		expect(relevant.map((diagnostic) => JSON.stringify(diagnostic)).toSorted()).toEqual(
			lint.diagnostics.map((diagnostic) => JSON.stringify(diagnostic)).toSorted(),
		);
	});
});
