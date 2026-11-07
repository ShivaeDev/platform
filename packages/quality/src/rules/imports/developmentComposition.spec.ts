import { noTestCode } from "#rules/imports/noTestCode.ts";
import { compositionFiles } from "#test/packageFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

for (const path of ["apps/server/dev.ts", "apps/server/script/dev.ts"]) {
	ruleStory.it(
		`imports/no-test-code accepts private test composition consumed by development tooling at ${path}`,
		[
			repositoryHas(
				...compositionFiles,
				{
					content: JSON.stringify({ name: "@example/server", scripts: { dev: `node ${path.slice("apps/server/".length)}` } }),
					path: "apps/server/package.json",
				},
				{ content: `import "${path.includes("/script/") ? "../../" : "../"}assembly/src/fixture.ts";`, path },
			),
		],
		function* ({ check }) {
			yield* assertThat(yield* check(noTestCode), (actual) => actual.toEqual([]));
		},
	);
}

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
