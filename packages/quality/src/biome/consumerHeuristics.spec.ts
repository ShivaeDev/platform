import { biomeStory, presetInstalled, repositoryHas } from "#test/biomeStory.ts";
import { fileInputs, generatorEntries, rendererCss } from "#test/consumerHeuristics.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

biomeStory.it(
	"noDoneCallback accepts fixture data destructuring in a custom generator entry and reports a Vitest done callback",
	[presetInstalled(), repositoryHas(generatorEntries)],
	function* ({ checks, reported }) {
		yield* checks();

		yield* assertThat(yield* reported("lint/style/noDoneCallback"), (actual) => actual.toEqual(["src/postgres.test.ts:5", "src/postgres.test.ts:6"]));
	},
);

biomeStory.it(
	"Quality accepts a comma-separated MIME list with spaces and still reports an invalid file-input type",
	[presetInstalled(), repositoryHas(fileInputs)],
	function* ({ checks, reported }) {
		yield* checks();

		yield* assertThat(yield* reported("lint/nursery/noInvalidFileInputAccept"), (actual) => actual.toEqual(["src/Upload.tsx:2"]));
	},
);

for (const [target, expected] of [
	["chrome 140", []],
	["electron 38.0", []],
	["chrome 100", ["src/renderer.css:1", "src/renderer.css:2"]],
	["chrome 140, firefox 130", ["src/renderer.css:1", "src/renderer.css:2"]],
	[undefined, ["src/renderer.css:1", "src/renderer.css:2"]],
] as const) {
	biomeStory.it(
		`useBaseline checks renderer pseudo-elements against ${target ?? "the shared default without a declared target"}`,
		[presetInstalled(), repositoryHas(rendererCss, { content: JSON.stringify({ browserslist: target, name: "renderer" }), path: "package.json" })],
		function* ({ checks, reported }) {
			yield* checks();

			yield* assertThat(yield* reported("lint/suspicious/useBaseline"), (actual) => actual.toEqual(expected));
		},
	);
}

biomeStory.it(
	"useBaseline reads a nested application's browserslistrc and leaves untargeted CSS on the shared default",
	[
		presetInstalled(),
		repositoryHas(
			{ content: "electron 38.0\n", path: "apps/desktop/.browserslistrc" },
			{ ...rendererCss, path: "apps/desktop/src/renderer.css" },
			{ ...rendererCss, path: "apps/web/src/renderer.css" },
		),
	],
	function* ({ checks, reported }) {
		yield* checks();

		yield* assertThat(yield* reported("lint/suspicious/useBaseline"), (actual) =>
			actual.toEqual(["apps/web/src/renderer.css:1", "apps/web/src/renderer.css:2"]),
		);
	},
);

for (const [target, expected] of [
	["chrome 140", []],
	["chrome 100", ["src/values.css:1", "src/values.css:1", "src/values.css:1"]],
] as const) {
	biomeStory.it(
		`useBaseline checks properties, values and nested CSS color functions against ${target}`,
		[
			presetInstalled(),
			repositoryHas(
				{ content: JSON.stringify({ browserslist: target, name: "renderer" }), path: "package.json" },
				{ content: "div { appearance: base-select; field-sizing: content; color: light-dark(red, blue); }", path: "src/values.css" },
			),
		],
		function* ({ checks, reported }) {
			yield* checks();

			yield* assertThat(yield* reported("lint/suspicious/useBaseline"), (actual) => actual.toEqual(expected));
		},
	);
}
