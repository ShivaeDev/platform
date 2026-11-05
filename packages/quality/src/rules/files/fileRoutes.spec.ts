import { noTodo } from "#rules/comments/noTodo.ts";
import { folderNames } from "#rules/files/folderNames.ts";
import { namedAfterExport } from "#rules/files/namedAfterExport.ts";
import { APP, fileRoutedApp, ROUTE_CONTENT, viteRoutedApp } from "#test/fileRoutedApp.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

for (const [name, folder, app] of [
	["tsr.config.json", "src/pages", fileRoutedApp('{"routesDirectory":"./src/pages"}', "src/pages")],
	["the router's default folder", "src/routes", fileRoutedApp("{}", "src/routes")],
	["a Vite plugin's literal options", "src/pages", viteRoutedApp('{ routesDirectory: "./src/pages" }', "src/pages")],
	["a Vite plugin's defaults", "src/routes", viteRoutedApp("", "src/routes")],
	["the legacy Vite plugin", "src/pages", viteRoutedApp('{ routesDirectory: "./src/pages" }', "src/pages", "TanStackRouterVite")],
] as const) {
	ruleStory.it(
		`file naming recognises a new route from ${name} without a config change, while an ordinary file stays checked`,
		[app],
		function* ({ check, locations, writes }) {
			yield* assertThat(yield* check(namedAfterExport), (actual) => actual.toEqual([]));

			yield* writes(
				{ content: ROUTE_CONTENT, path: `${APP}/${folder}/_signed-in/posts.$postId.tsx` },
				{ content: ROUTE_CONTENT, path: `${APP}/src/ordinary.ts` },
			);

			yield* check(namedAfterExport);

			yield* assertThat(yield* locations(), (actual) => actual.toEqual([`${APP}/src/ordinary.ts`]));
		},
	);
}

ruleStory.it(
	"folder naming accepts route groups and pathless layouts while checking ordinary folders",
	[
		fileRoutedApp("{}", "src/routes"),
		repositoryHas(
			{ content: ROUTE_CONTENT, path: `${APP}/src/routes/(account)/_signed-in/index.tsx` },
			{ content: "export const value = 1;", path: `${APP}/src/(ordinary)/value.ts` },
		),
	],
	function* ({ check, locations }) {
		yield* check(folderNames);

		yield* assertThat(yield* locations(), (actual) => actual.toEqual([`${APP}/src/(ordinary)`]));
	},
);

ruleStory.it(
	"a folder named routes without router configuration stays checked",
	[repositoryHas({ content: ROUTE_CONTENT, path: "src/routes/index.tsx" })],
	function* ({ check, locations }) {
		yield* check(namedAfterExport);

		yield* assertThat(yield* locations(), (actual) => actual.toEqual(["src/routes/index.tsx"]));
	},
);

ruleStory.it(
	"route naming stays scoped to the configured app and folder",
	[
		fileRoutedApp('{"routesDirectory":"src/pages"}', "src/pages"),
		repositoryHas(
			{ content: ROUTE_CONTENT, path: `${APP}/src/pagesOther/index.tsx` },
			{ content: ROUTE_CONTENT, path: "apps/other/src/pages/index.tsx" },
		),
	],
	function* ({ check, locations }) {
		yield* check(namedAfterExport);

		yield* assertThat(yield* locations(), (actual) => actual.toEqual(["apps/other/src/pages/index.tsx", `${APP}/src/pagesOther/index.tsx`]));
	},
);

ruleStory.it(
	"Vite route options override tsr.config.json options in the same app",
	[
		fileRoutedApp(
			'{"routesDirectory":"src/old"}',
			"src/pages",
			'import { tanstackRouter } from "@tanstack/router-plugin/vite"; export default { plugins: [tanstackRouter({ routesDirectory: "src/pages" })] };',
		),
		repositoryHas({ content: ROUTE_CONTENT, path: `${APP}/src/old/index.tsx` }),
	],
	function* ({ check, locations }) {
		yield* check(namedAfterExport);

		yield* assertThat(yield* locations(), (actual) => actual.toEqual([`${APP}/src/old/index.tsx`]));
	},
);

ruleStory.it(
	"routes remain subject to other source checks",
	[fileRoutedApp("{}", "src/routes"), repositoryHas({ content: `${ROUTE_CONTENT}// TODO finish this\n`, path: `${APP}/src/routes/index.tsx` })],
	function* ({ check, locations }) {
		yield* check(noTodo);

		yield* assertThat(yield* locations(), (actual) => actual.toEqual([`${APP}/src/routes/index.tsx:2`]));
	},
);

ruleStory.it(
	"an unrelated plugin does not establish route ownership",
	[
		repositoryHas(
			{ content: 'import { tanstackRouter } from "other-plugin"; tanstackRouter({ routesDirectory: "src/routes" });', path: "vite.config.ts" },
			{ content: ROUTE_CONTENT, path: "src/routes/index.tsx" },
		),
	],
	function* ({ check, locations }) {
		yield* check(namedAfterExport);

		yield* assertThat(yield* locations(), (actual) => actual.toEqual(["src/routes/index.tsx"]));
	},
);
