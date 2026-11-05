import { assertThat } from "@shivaedev/test-kits/quality/adapters/assertThat.ts";
import { DEFAULT_FILES, packageRoot } from "@shivaedev/test-kits/quality/adapters/tree.ts";
import { biome } from "#rules/biome.ts";
import { repositoryHas, repositoryLinks, ruleStory } from "#test/ruleStory.ts";
import { importForms, localAliasFacade, realWrappers, secondNameFiles, typeImportForms } from "#test/secondNameFiles.ts";
import { noBarrel } from "./noBarrel.ts";

const PRESET = [
	repositoryHas(...DEFAULT_FILES.filter((file) => file.path !== "src/value.ts")),
	repositoryLinks("node_modules/@shivaedev/quality", packageRoot),
];

for (const file of secondNameFiles) {
	ruleStory.it(`the author sees a ${file.shape} and its defining module`, [...PRESET, repositoryHas(file)], function* ({ check }) {
		const findings = yield* check(file.shape === "type alias" ? biome : noBarrel);
		yield* assertThat(
			findings.filter(({ message }) => message.includes("second name")),
			(actual, expect) => actual.toEqual([expect.objectContaining({ file: file.path, line: 2, message: expect.stringContaining("Help: Import") })]),
		);
		yield* assertThat(findings.find(({ message }) => message.includes("second name"))?.message, (actual) => actual.toContain('"./owner.ts"'));
	});
}

ruleStory.it("local const aliases cannot hide an imported facade", [repositoryHas(localAliasFacade)], function* ({ check }) {
	yield* assertThat(yield* check(noBarrel), (actual, expect) =>
		actual.toEqual([{ file: "src/chain.ts", line: 4, message: expect.stringContaining('Help: Import directly from "./owner.ts"') }]),
	);
});

ruleStory.it("wrappers that add behaviour keep their own names", [...PRESET, repositoryHas(realWrappers)], function* ({ check }) {
	yield* assertThat(yield* check(noBarrel), (actual) => actual.toEqual([]));
	const findings = yield* check(biome);
	yield* assertThat(
		findings.filter(({ message }) => message.startsWith("A module never re-exports")),
		(actual) => actual.toEqual([]),
	);
});

ruleStory.it("aliases through default, namespace, renamed and later exports name their owners", [repositoryHas(importForms)], function* ({ check }) {
	const findings = yield* check(noBarrel);
	yield* assertThat(
		findings.map(({ line }) => line),
		(actual) => actual.toEqual([4, 5, 6]),
	);
	yield* assertThat(
		findings.map(({ message }) => message),
		(actual, expect) =>
			actual.toEqual([expect.stringContaining('"./default.ts"'), expect.stringContaining('"./owner.ts"'), expect.stringContaining('"./renamed.ts"')]),
	);
});

ruleStory.it(
	"type aliases of renamed, inline-type and default imports identify their defining modules",
	[...PRESET, repositoryHas(typeImportForms)],
	function* ({ check }) {
		const findings = (yield* check(biome)).filter(({ message }) => message.startsWith("A module never re-exports"));
		yield* assertThat(
			findings.map(({ line }) => line),
			(actual) => actual.toEqual([4, 5, 6]),
		);
		yield* assertThat(
			findings.map(({ message }) => message),
			(actual, expect) =>
				actual.toEqual([expect.stringContaining('"./owner.ts"'), expect.stringContaining('"./other.ts"'), expect.stringContaining('"./default.ts"')]),
		);
	},
);
