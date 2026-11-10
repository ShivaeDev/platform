import { biomeStory, presetInstalled, repositoryHas } from "#test/biomeStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

for (const flags of ["--config test/setup.ts --reporter test/report.ts", '--config="test/setup.ts" --reporter=./test/report.ts']) {
	biomeStory.it(
		"Biome accepts explicit Vitest config and reporter contracts beside ordinary module defaults",
		[
			presetInstalled(),
			repositoryHas(
				{ content: JSON.stringify({ name: "app", scripts: { test: `vitest run ${flags}` } }), path: "apps/web/package.json" },
				{ content: "export default {};\n", path: "apps/web/test/setup.ts" },
				{ content: "export default class Reporter {}\n", path: "apps/web/test/report.ts" },
				{ content: "export default {};\n", path: "apps/web/src/ordinary.ts" },
			),
		],
		function* ({ checks, reported }) {
			yield* checks();
			yield* assertThat(yield* reported("lint/style/noDefaultExport"), (actual) => actual.toEqual(["apps/web/src/ordinary.ts:1"]));
		},
	);
}

biomeStory.it(
	"Biome accepts a foreign host's typed plugin default in core code beside an ordinary module default",
	[
		presetInstalled(),
		repositoryHas(
			{
				content: 'import type { Plugin } from "@editor/plugin";\nconst plugin: Plugin = async () => ({});\nexport default plugin;\n',
				path: "src/editor.ts",
			},
			{ content: "export default {};\n", path: "src/ordinary.ts" },
			{
				content: 'import type { Plugin } from "./plugin.ts";\nconst ordinary: Plugin = async () => ({});\nexport default ordinary;\n',
				path: "src/local.ts",
			},
			{ content: "export type Plugin = () => Promise<object>;\n", path: "src/plugin.ts" },
		),
	],
	function* ({ checks, reported }) {
		yield* checks();
		yield* assertThat(yield* reported("lint/style/noDefaultExport"), (actual) => actual.toEqual(["src/local.ts:3", "src/ordinary.ts:1"]));
	},
);
