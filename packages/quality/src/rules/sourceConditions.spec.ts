import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { manifestsSourceFirst } from "#rules/manifestsSourceFirst.ts";
import { conditionManifest } from "#test/manifestStory.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const SOURCE_FIRST = '{ "source": "./src/*.ts", "types": "./dist/*.d.ts", "default": "./dist/*.js" }';

const TYPES_FIRST = '{ "types": "./dist/*.d.ts", "source": "./src/*.ts", "default": "./dist/*.js" }';

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
		`manifests/source-first reports ${name} that lists source after types, at its line`,
		[repositoryHas(manifest)],
		function* ({ check, locations, messages }) {
			yield* check(manifestsSourceFirst);

			yield* outcomes([
				["location", () => locations(), ["packages/a/package.json:5"]],
				[
					"message",
					() => messages(),
					[
						`Lists the "source" condition after "types" in ${field}. TypeScript takes the first condition that matches, so once built output exists it reads that instead of the sources the "source" condition names. Move "source" to the top of this condition block.`,
					],
				],
			]);
		},
	);
}

ruleStory.it(
	"manifests/source-first accepts condition blocks that list source first or do not name it",
	[
		repositoryHas(
			conditionManifest("packages/a/package.json", `{ "./*.ts": ${SOURCE_FIRST} }`, `{ "#*.ts": ${SOURCE_FIRST} }`),
			conditionManifest("packages/b/package.json", '{ "./*.ts": { "types": "./dist/*.d.ts", "default": "./dist/*.js" } }'),
		),
	],
	function* ({ check }) {
		expect(yield* check(manifestsSourceFirst)).toEqual([]);
	},
);
