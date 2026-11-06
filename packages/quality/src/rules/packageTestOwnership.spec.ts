import { importsManifest } from "#rules/imports/manifest.ts";
import { noTestCode } from "#rules/imports/noTestCode.ts";
import { maxLines } from "#rules/maxLines.ts";
import { testsColocated } from "#rules/test-names/colocated.ts";
import { testsFollow } from "#rules/test-names/follow.ts";
import { compositionFiles, fakeBackend, packageFiles } from "#test/packageFiles.ts";
import { repositoryHas, repositoryLinks, ruleStory } from "#test/ruleStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

ruleStory.it(
	"imports/manifest accepts dev dependencies in a package test tree and still rejects their production use",
	[repositoryHas(...packageFiles, { content: 'import "../../traces/src/trace.ts";', path: "apps/server/src/tracing.ts" })],
	function* ({ check, locations }) {
		yield* check(importsManifest);
		yield* assertThat(yield* locations(), (actual) => actual.toEqual(["apps/server/src/tracing.ts:1"]));
	},
);

ruleStory.it(
	"imports/no-test-code accepts a private composition package used only by package tests",
	[repositoryHas(...compositionFiles)],
	function* ({ check }) {
		yield* assertThat(yield* check(noTestCode), (actual) => actual.toEqual([]));
	},
);

for (const importer of [
	{ content: 'import "../../assembly/src/fixture.ts";', path: "apps/server/src/app.ts" },
	{ content: 'export type { Fixture } from "../../assembly/src/fixture.ts";', path: "apps/server/src/app.ts" },
]) {
	ruleStory.it(
		`imports/no-test-code keeps composition production when reached by ${importer.content}`,
		[repositoryHas(...compositionFiles, importer)],
		function* ({ check, locations }) {
			yield* check(noTestCode);
			yield* assertThat(yield* locations(), (actual) => actual.toEqual(["apps/assembly/src/fixture.ts:1"]));
		},
	);
}

ruleStory.it(
	"imports/no-test-code reports production imports of helpers in a package test tree",
	[repositoryHas(...packageFiles, { content: 'import "../test/mail/resting.ts";', path: "apps/server/src/app.ts" })],
	function* ({ check, locations }) {
		yield* check(noTestCode);
		yield* assertThat(yield* locations(), (actual) => actual.toEqual(["apps/server/src/app.ts:1"]));
	},
);

ruleStory.it(
	"structure/max-lines applies the test cap to package test helpers and composition, retaining both caps",
	[
		repositoryHas(
			...compositionFiles,
			fakeBackend("apps/runner/test/backends/codex/fake.ts", 162),
			fakeBackend("apps/assembly/src/backend.ts", 162),
			fakeBackend("apps/server/src/backend.ts", 162),
			fakeBackend("apps/server/test/backends/oversized.ts", 301),
		),
	],
	function* ({ check, locations }) {
		yield* check(maxLines);
		yield* assertThat(yield* locations(), (actual) => actual.toEqual(["apps/server/src/backend.ts", "apps/server/test/backends/oversized.ts"]));
	},
);

for (const rule of [testsFollow, testsColocated]) {
	ruleStory.it(
		`${rule.id} recognises the package-owned suite and retains findings for an unowned test folder`,
		[repositoryHas(...packageFiles, { content: 'import "../../../apps/server/src/mail/send.ts";', path: "integration/test/mail/send.test.ts" })],
		function* ({ check, locations }) {
			yield* check(rule);
			yield* assertThat(yield* locations(), (actual) => actual.toEqual(["integration/test/mail/send.test.ts"]));
		},
	);
}

for (const manifest of [
	'{"name":"@example/assembly","exports":{"./*.ts":"./src/*.ts"},"imports":{"#test/*":"./src/test-support/*"}}',
	'{"name":"@example/assembly","private":true,"bin":"./src/fixture.ts","imports":{"#test/*":"./src/test-support/*"}}',
]) {
	ruleStory.it(
		`imports/no-test-code keeps published or executable packages production: ${manifest}`,
		[repositoryHas(...compositionFiles, { content: manifest, path: "apps/assembly/package.json" })],
		function* ({ check, locations }) {
			yield* check(noTestCode);
			yield* assertThat(yield* locations(), (actual) => actual.toEqual(["apps/assembly/src/fixture.ts:1"]));
		},
	);
}

ruleStory.it(
	"imports/no-test-code does not infer composition without test consumers",
	[repositoryHas(...compositionFiles)],
	function* ({ removes, check, locations }) {
		yield* removes("apps/server/test/assembly.spec.ts");
		yield* check(noTestCode);
		yield* assertThat(yield* locations(), (actual) => actual.toEqual(["apps/assembly/src/fixture.ts:1"]));
	},
);

ruleStory.it(
	"imports/no-test-code follows transitive test composition through cycles and propagates a production consumer back through it",
	[
		repositoryHas(
			...compositionFiles,
			{ content: '{"name":"@example/harness","private":true}', path: "apps/harness/package.json" },
			{ content: 'import "../../assembly/src/fixture.ts";', path: "apps/harness/src/harness.ts" },
			{ content: 'import "../../harness/src/harness.ts";', path: "apps/assembly/src/cycle.ts" },
			{ content: 'import "../../harness/src/harness.ts";', path: "apps/server/test/assembly.spec.ts" },
		),
	],
	function* ({ check, writes, locations }) {
		yield* assertThat(yield* check(noTestCode), (actual) => actual.toEqual([]));
		yield* writes({ content: 'import "../../harness/src/harness.ts";', path: "apps/server/src/entry.ts" });
		yield* check(noTestCode);
		yield* assertThat(yield* locations(), (actual) => actual.toEqual(["apps/assembly/src/fixture.ts:1"]));
	},
);

for (const rule of [testsFollow, testsColocated]) {
	ruleStory.it(
		`${rule.id} recognises a standalone package test tree`,
		[
			repositoryHas(
				{ content: '{"name":"standalone"}', path: "package.json" },
				{ content: "export const send = 'sent';", path: "src/mail/send.ts" },
				{ content: 'import "../../src/mail/send.ts";', path: "test/mail/send.test.ts" },
			),
		],
		function* ({ check }) {
			yield* assertThat(yield* check(rule), (actual) => actual.toEqual([]));
		},
	);
}

ruleStory.it(
	"tests/follow still reports a test with no corresponding package source file and invalid modifiers",
	[repositoryHas(...packageFiles, { content: "", path: "apps/server/test/mail/missing.unit.dom.test.ts" })],
	function* ({ check, messages }) {
		yield* check(testsFollow);
		yield* assertThat(yield* messages(), (actual, expect) =>
			actual.toEqual([expect.stringContaining("both a unit and a DOM test"), expect.stringContaining("follows no file")]),
		);
	},
);

ruleStory.it(
	"imports/no-test-code resolves a private composition package through its workspace export",
	[
		repositoryHas(...compositionFiles, { content: 'import "@example/assembly/fixture.ts";', path: "apps/server/test/assembly.spec.ts" }),
		repositoryLinks("node_modules/@example/assembly", "../../apps/assembly"),
	],
	function* ({ check }) {
		yield* assertThat(yield* check(noTestCode), (actual) => actual.toEqual([]));
	},
);

for (const start of ["node ./src/fixture.ts", "node ./dist/fixture.js"]) {
	ruleStory.it(
		`imports/no-test-code keeps a private application launched by its script production: ${start}`,
		[
			repositoryHas(...compositionFiles, {
				content: JSON.stringify({ imports: { "#test/*": "./src/test-support/*" }, name: "@example/assembly", private: true, scripts: { start } }),
				path: "apps/assembly/package.json",
			}),
		],
		function* ({ check, locations }) {
			yield* check(noTestCode);
			yield* assertThat(yield* locations(), (actual) => actual.toEqual(["apps/assembly/src/fixture.ts:1"]));
		},
	);
}

ruleStory.it(
	"imports/no-test-code keeps test-composition entry scripts in the test boundary",
	[
		repositoryHas(...compositionFiles, {
			content:
				'{"name":"@example/assembly","private":true,"imports":{"#test/*":"./src/test-support/*"},"scripts":{"test:fixture":"node ./src/fixture.ts"}}',
			path: "apps/assembly/package.json",
		}),
	],
	function* ({ check }) {
		yield* assertThat(yield* check(noTestCode), (actual) => actual.toEqual([]));
	},
);

ruleStory.it(
	"imports/no-test-code recognises a production entry script declared at the workspace root",
	[
		repositoryHas(...compositionFiles, {
			content: '{"workspaces":["apps/*"],"scripts":{"start":"node apps/assembly/dist/fixture.js"}}',
			path: "package.json",
		}),
	],
	function* ({ check, locations }) {
		yield* check(noTestCode);
		yield* assertThat(yield* locations(), (actual) => actual.toEqual(["apps/assembly/src/fixture.ts:1"]));
	},
);
