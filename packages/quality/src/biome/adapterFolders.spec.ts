import { inAdaptersOrTestSupport } from "#naming/unsafeFolders.ts";
import { biomeStory, presetInstalled, repositoryHas } from "#test/biomeStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

const PATHS = [
	"adapters/root.ts",
	"src/adapters/flat.ts",
	"src/server/adapters/deep/nested.ts",
	"src/adapters.ts",
	"src/myadapters/near.ts",
	"src/adapters-old/near.ts",
	"src/test-support/kit.ts",
	"src/test-supports/near.ts",
	"src/core.ts",
];

const CONTENT = 'export const later = (run: () => void) => setTimeout(run, 10);\nexport const draft = () => localStorage.getItem("draft");\n';

biomeStory.it(
	"the ambient-runtime plugin exempts exactly the paths that Quality's shared adapters/ and test-support/ matcher accepts",
	[presetInstalled(), repositoryHas(...PATHS.map((path) => ({ content: CONTENT, path })))],
	function* ({ checks, reported }) {
		yield* checks();

		yield* assertThat(yield* reported("plugin"), (actual) =>
			actual.toEqual(
				PATHS.filter((path) => !inAdaptersOrTestSupport(path))
					.toSorted((left, right) => left.localeCompare(right))
					.flatMap((path) => [`${path}:1`, `${path}:2`]),
			),
		);
	},
);
