import { assertThat } from "@shivaedev/test-kits/quality/adapters/assertThat.ts";
import { manifestsNoTestKits } from "#rules/manifestsNoTestKits.ts";
import { exportsPackage } from "#test/exportsPackage.ts";
import { publishedTestingFiles, RUNTIME_MANIFEST } from "#test/publishedTestingFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

ruleStory.it(
	"a runtime package with only development test dependencies and unexported testing code passes",
	[
		repositoryHas(
			...publishedTestingFiles(
				{ devDependencies: { "@shivaedev/test-kits": "workspace:*", vitest: "catalog:" }, exports: { "./live.ts": "./src/live.ts" } },
				"testing.ts",
			),
		),
	],
	function* ({ check }) {
		const findings = yield* check(manifestsNoTestKits);

		yield* assertThat(findings, (actual) => actual.toEqual([]));
	},
);

const EXPORTS = [
	["a testing subpath", { exports: { "./testing": "./src/helper.ts" } }, undefined],
	["a testing target behind a conditional export", { exports: { ".": { import: "./src/testing.ts" } } }, undefined],
	["a testing target in a fallback array", { exports: { ".": [null, "./src/testing.ts"] } }, undefined],
	["a testing file through the public wildcard", {}, "testing.ts"],
	["a nested testing folder through the public wildcard", {}, "server/testing/helper.ts"],
	["an explicit test-support export", { exports: { "./helper": "./src/test-support/helper.ts" } }, undefined],
	["an explicit test-file export", { exports: { "./helper": "./src/helper.test.ts" } }, undefined],
	["a testing main entry", { exports: undefined, main: "./src/testing.ts" }, undefined],
] as const;

for (const [form, fields, module] of EXPORTS) {
	ruleStory.it(
		`a runtime package publishing ${form} receives a finding naming the package and test-kits repair`,
		[repositoryHas(...publishedTestingFiles(fields, module))],
		function* ({ check }) {
			const findings = yield* check(manifestsNoTestKits);

			yield* assertThat(findings, (actual, expect) =>
				actual.toEqual([
					{
						file: RUNTIME_MANIFEST,
						message: expect.stringMatching(
							/^Runtime package "@acme\/runtime" publishes testing modules: .+\. Move the helper into @shivaedev\/test-kits/u,
						),
						subject: "exports",
					},
				]),
			);
		},
	);
}

for (const field of ["dependencies", "peerDependencies", "optionalDependencies"]) {
	for (const dependency of ["@shivaedev/test", "@shivaedev/test-story", "@shivaedev/test-sql", "@shivaedev/test-kits", "vitest"]) {
		ruleStory.it(
			`a runtime package declaring ${dependency} in ${field} receives the package name and test-kits repair`,
			[repositoryHas(...publishedTestingFiles({ [field]: { [dependency]: "1.0.0" }, peerDependenciesMeta: { [dependency]: { optional: true } } }))],
			function* ({ check }) {
				const findings = yield* check(manifestsNoTestKits);

				yield* assertThat(findings, (actual) =>
					actual.toEqual([
						{
							file: RUNTIME_MANIFEST,
							message: `Runtime package "@acme/runtime" declares test package "${dependency}" in ${field}. Move the helper into @shivaedev/test-kits and keep test dependencies in devDependencies.`,
							subject: `${field}.${dependency}`,
						},
					]),
				);
			},
		);
	}
}

ruleStory.it(
	"test packages and private applications may publish testing modules and depend on test packages",
	[
		repositoryHas(
			...publishedTestingFiles({ dependencies: { "@shivaedev/test-kits": "workspace:*" }, private: true }, "testing.ts"),
			...["test", "test-story", "test-sql", "test-kits", "vitest-rerun"].map((name) =>
				exportsPackage(
					{ exports: { "./testing": "./src/testing.ts" }, name: `@shivaedev/${name}`, peerDependencies: { vitest: "catalog:" } },
					`packages/${name}/package.json`,
				),
			),
		),
	],
	function* ({ check }) {
		const findings = yield* check(manifestsNoTestKits);

		yield* assertThat(findings, (actual) => actual.toEqual([]));
	},
);

ruleStory.it(
	"a blocked testing export and a similarly named production module pass",
	[
		repositoryHas(
			...publishedTestingFiles({ exports: { "./*.ts": "./src/*.ts", "./testing.ts": null } }, "testing.ts"),
			...publishedTestingFiles({}, "testingTools.ts").slice(1),
		),
	],
	function* ({ check }) {
		const findings = yield* check(manifestsNoTestKits);

		yield* assertThat(findings, (actual) => actual.toEqual([]));
	},
);
