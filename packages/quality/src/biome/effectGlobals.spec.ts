import { biomeStory, presetInstalled, repositoryHas } from "#test/biomeStory.ts";
import { effectRootImports } from "#test/effectRootImports.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

const SHADOWED = "lint/suspicious/noShadowRestrictedNames";

const EFFECT_MODULES = {
	content: ['import { Array, Boolean, Number, String } from "effect";', "export const modules = [Array, Boolean, Number, String];"]
		.join("\n")
		.concat("\n"),
	path: "src/modules.ts",
};

const FOREIGN_IMPORT = { content: 'import { Array } from "./array.ts";\nexport const items = Array;\n', path: "src/foreign.ts" };

const SUBPATH_IMPORT = { content: 'import { String } from "effect/String";\nexport const text = String;\n', path: "src/subpath.ts" };

const RENAMED_IMPORT = { content: 'import { Chunk as Array } from "effect";\nexport const chunk = Array;\n', path: "src/renamed.ts" };

const NAMESPACE_IMPORT = { content: 'import * as Array from "effect";\nexport const effect = Array;\n', path: "src/namespace.ts" };

const DEFAULT_IMPORT = { content: 'import Array from "effect";\nexport const effect = Array;\n', path: "src/default.ts" };

const LOCAL_CONSTANT = { content: "const Array = [1];\nexport const items = Array;\n", path: "src/constant.ts" };

const PARAMETER = { content: "export function parse(String: unknown) {\n\treturn String;\n}\n", path: "src/parameter.ts" };

biomeStory.it(
	"quality accepts Array, Boolean, Number and String imported from effect under their own names",
	[presetInstalled(), repositoryHas(EFFECT_MODULES)],
	function* ({ checks, reported }) {
		yield* checks();

		yield* assertThat(yield* reported(SHADOWED), (actual) => actual.toEqual([]));
	},
);

biomeStory.it(
	"quality accepts every root module of the installed effect imported under its own name",
	[presetInstalled(), repositoryHas(effectRootImports("src/effect.ts"))],
	function* ({ checks, reported }) {
		yield* checks();

		yield* assertThat(yield* reported(SHADOWED), (actual) => actual.toEqual([]));
	},
);

for (const [shadowing, file] of [
	["an import of Array from another module", FOREIGN_IMPORT],
	["an import of String from an effect subpath", SUBPATH_IMPORT],
	["another effect export renamed to Array", RENAMED_IMPORT],
	["a namespace import of effect named Array", NAMESPACE_IMPORT],
	["a default import of effect named Array", DEFAULT_IMPORT],
	["a local constant named Array", LOCAL_CONSTANT],
	["a parameter named String", PARAMETER],
] as const) {
	biomeStory.it(
		`quality reports noShadowRestrictedNames for ${shadowing}`,
		[presetInstalled(), repositoryHas(file)],
		function* ({ checks, reported }) {
			yield* checks();

			yield* assertThat(yield* reported(SHADOWED), (actual) => actual.toEqual([`${file.path}:1`]));
		},
	);
}
