import { assertThat } from "@shivaedev/test-kits/quality/adapters/assertThat.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { manifestsSourceFirst } from "#rules/manifestsSourceFirst.ts";
import { conditionManifest } from "#test/manifestStory.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

for (const condition of ["@shivaedev/source", "source"]) {
	const SOURCE_FIRST = `{ "${condition}": "./src/*.ts", "types": "./dist/*.d.ts", "default": "./dist/*.js" }`;

	const TYPES_FIRST = `{ "types": "./dist/*.d.ts", "${condition}": "./src/*.ts", "default": "./dist/*.js" }`;

	const LATE_SOURCE = [
		{ field: "exports", manifest: conditionManifest("packages/a/package.json", `{ "./*.ts": ${TYPES_FIRST} }`), name: "an exports condition block" },
		{
			field: "imports",
			manifest: conditionManifest("packages/a/package.json", `{ "./*.ts": ${SOURCE_FIRST} }`, `{ "#*.ts": { "node": ${TYPES_FIRST} } }`),
			name: "an imports condition block nested under another condition",
		},
	];

	for (const { field, manifest, name } of LATE_SOURCE) {
		ruleStory.it(
			`manifests/source-first reports ${name} that lists ${condition} after types, at its line`,
			[repositoryHas(manifest)],
			function* ({ check, locations, messages }) {
				yield* check(manifestsSourceFirst);

				yield* outcomes([
					["location", () => locations(), ["packages/a/package.json:5"]],
					[
						"message",
						() => messages(),
						[
							`Lists the "${condition}" condition after "types" in ${field}. TypeScript takes the first condition that matches, so once built output exists it reads that instead of the sources the "${condition}" condition names. Move "${condition}" to the top of this condition block.`,
						],
					],
				]);
			},
		);
	}

	ruleStory.it(
		`manifests/source-first accepts condition blocks that list ${condition} first or do not name it`,
		[
			repositoryHas(
				conditionManifest("packages/a/package.json", `{ "./*.ts": ${SOURCE_FIRST} }`, `{ "#*.ts": ${SOURCE_FIRST} }`),
				conditionManifest("packages/b/package.json", '{ "./*.ts": { "types": "./dist/*.d.ts", "default": "./dist/*.js" } }'),
			),
		],
		function* ({ check }) {
			yield* assertThat(yield* check(manifestsSourceFirst), (actual) => actual.toEqual([]));
		},
	);
}
