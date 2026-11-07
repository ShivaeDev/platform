import { importsManifest } from "#rules/imports/manifest.ts";
import { noTestCode } from "#rules/imports/noTestCode.ts";
import { maxLines } from "#rules/maxLines.ts";
import { compositionFiles, fakeBackend } from "#test/packageFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

for (const path of ["apps/server/dev.ts", "apps/server/script/dev.ts"]) {
	for (const rule of [noTestCode, importsManifest]) {
		ruleStory.it(
			`${rule.id} accepts private test composition consumed by development tooling at ${path}`,
			[
				repositoryHas(
					...compositionFiles,
					{
						content: JSON.stringify({
							devDependencies: { "@example/assembly": "workspace:*", "@example/traces": "workspace:*" },
							name: "@example/server",
							scripts: { dev: `node ${path.slice("apps/server/".length)}` },
						}),
						path: "apps/server/package.json",
					},
					{ content: `import "${path.includes("/script/") ? "../../" : "../"}assembly/src/fixture.ts";`, path },
				),
			],
			function* ({ check }) {
				yield* assertThat(yield* check(rule), (actual) => actual.toEqual([]));
			},
		);
	}
}

ruleStory.it(
	"structure/max-lines keeps development scripts at the source limit",
	[
		repositoryHas(
			...compositionFiles,
			{ content: '{"name":"@example/server","scripts":{"dev":"node dev.ts"}}', path: "apps/server/package.json" },
			fakeBackend("apps/server/dev.ts", 160),
		),
	],
	function* ({ check, locations }) {
		yield* check(maxLines);
		yield* assertThat(yield* locations(), (actual) => actual.toEqual(["apps/server/dev.ts"]));
	},
);

ruleStory.it(
	"imports/no-test-code still reports a production consumer beside development tooling",
	[
		repositoryHas(
			...compositionFiles,
			{ content: '{"name":"@example/server","scripts":{"dev":"node dev.ts"}}', path: "apps/server/package.json" },
			{ content: 'import "../assembly/src/fixture.ts";', path: "apps/server/dev.ts" },
			{ content: 'import "../../assembly/src/fixture.ts";', path: "apps/server/src/app.ts" },
		),
	],
	function* ({ check, locations }) {
		yield* check(noTestCode);
		yield* assertThat(yield* locations(), (actual) => actual.toEqual(["apps/assembly/src/fixture.ts:1"]));
	},
);
