import { expect } from "vitest";
import { biome } from "#rules/biome.ts";
import { repositoryHas, repositoryLinks, ruleStory } from "#test/ruleStory.ts";
import { importForms, localAliasFacade, realWrappers, secondNameFiles, typeImportForms } from "#test/secondNameFiles.ts";
import { DEFAULT_FILES, packageRoot } from "#test/tree.ts";
import { noBarrel } from "./noBarrel.ts";

const PRESET = [
	repositoryHas(...DEFAULT_FILES.filter((file) => file.path !== "src/value.ts")),
	repositoryLinks("node_modules/@shivaedev/quality", packageRoot),
];

for (const file of secondNameFiles) {
	ruleStory.it(`the author sees a ${file.shape} and its defining module`, [...PRESET, repositoryHas(file)], function* ({ check }) {
		const findings = yield* check(file.shape === "type alias" ? biome : noBarrel);
		expect(findings.filter(({ message }) => message.includes("second name"))).toEqual([
			expect.objectContaining({ file: file.path, line: 2, message: expect.stringContaining("Help: Import") }),
		]);
		expect(findings.find(({ message }) => message.includes("second name"))?.message).toContain('"./owner.ts"');
	});
}

ruleStory.it("local const aliases cannot hide an imported facade", [repositoryHas(localAliasFacade)], function* ({ check }) {
	expect(yield* check(noBarrel)).toEqual([
		{ file: "src/chain.ts", line: 4, message: expect.stringContaining('Help: Import directly from "./owner.ts"') },
	]);
});

ruleStory.it("wrappers that add behaviour keep their own names", [...PRESET, repositoryHas(realWrappers)], function* ({ check }) {
	expect(yield* check(noBarrel)).toEqual([]);
	const findings = yield* check(biome);
	expect(findings.filter(({ message }) => message.startsWith("A module never re-exports"))).toEqual([]);
});

ruleStory.it("aliases through default, namespace, renamed and later exports name their owners", [repositoryHas(importForms)], function* ({ check }) {
	const findings = yield* check(noBarrel);
	expect(findings.map(({ line }) => line)).toEqual([4, 5, 6]);
	expect(findings.map(({ message }) => message)).toEqual([
		expect.stringContaining('"./default.ts"'),
		expect.stringContaining('"./owner.ts"'),
		expect.stringContaining('"./renamed.ts"'),
	]);
});

ruleStory.it(
	"type aliases of renamed, inline-type and default imports identify their defining modules",
	[...PRESET, repositoryHas(typeImportForms)],
	function* ({ check }) {
		const findings = (yield* check(biome)).filter(({ message }) => message.startsWith("A module never re-exports"));
		expect(findings.map(({ line }) => line)).toEqual([4, 5, 6]);
		expect(findings.map(({ message }) => message)).toEqual([
			expect.stringContaining('"./owner.ts"'),
			expect.stringContaining('"./other.ts"'),
			expect.stringContaining('"./default.ts"'),
		]);
	},
);
