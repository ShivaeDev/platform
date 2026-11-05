import { assertThat } from "@shivaedev/test-kits/quality/adapters/assertThat.ts";
import { namedAfterExport } from "#rules/files/namedAfterExport.ts";
import { APP, fileRoutedApp, ROUTE_CONTENT } from "#test/fileRoutedApp.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

for (const [name, options, file] of [
	["the default ignore prefix", "{}", "-helpers.ts"],
	["an ignored folder", "{}", "-helpers/index.ts"],
	["a configured ignore prefix", '{"routeFileIgnorePrefix":"skip"}', "skipHelpers.ts"],
	["a configured ignore pattern", '{"routeFileIgnorePattern":"helper"}', "helpers.ts"],
] as const) {
	ruleStory.it(
		`route naming keeps files excluded by ${name} checked`,
		[fileRoutedApp(options, "src/routes"), repositoryHas({ content: ROUTE_CONTENT, path: `${APP}/src/routes/${file}` })],
		function* ({ check, locations }) {
			yield* check(namedAfterExport);

			yield* assertThat(yield* locations(), (actual) => actual.toEqual([`${APP}/src/routes/${file}`]));
		},
	);
}

ruleStory.it(
	"a route prefix applies to folders as well as files",
	[
		repositoryHas(
			{ content: '{"routeFilePrefix":"route-"}', path: "tsr.config.json" },
			{ content: ROUTE_CONTENT, path: "src/routes/route-__root.tsx" },
			{ content: ROUTE_CONTENT, path: "src/routes/route-posts/route-$id.tsx" },
			{ content: ROUTE_CONTENT, path: "src/routes/posts/route-$id.tsx" },
			{ content: ROUTE_CONTENT, path: "src/routes/helpers.ts" },
		),
	],
	function* ({ check, locations }) {
		yield* check(namedAfterExport);

		yield* assertThat(yield* locations(), (actual) =>
			actual.toEqual(["src/routes/helpers.ts", "src/routes/posts/route-$id.tsx", "src/routes/posts/route-$id.tsx"]),
		);
	},
);
