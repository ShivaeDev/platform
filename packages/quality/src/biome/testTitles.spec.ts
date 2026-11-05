import { biomeStory, presetInstalled, repositoryHas } from "#test/biomeStory.ts";
import { helperNamed, invalidTestTitle } from "#test/titleInputs.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

for (const name of ["describe", "it", "test"]) {
	biomeStory.it(
		`the preset accepts a number passed as the title to an ordinary ${name} function outside test code`,
		[presetInstalled(), repositoryHas(helperNamed(name))],
		function* ({ checks, reported }) {
			yield* checks();

			yield* assertThat(yield* reported("lint/nursery/useValidTestTitle"), (actual) => actual.toEqual([]));
		},
	);
}

for (const path of ["src/titles.spec.ts", "src/titles.test.ts", "src/test-support/titles.ts"]) {
	biomeStory.it(
		`the preset rejects a non-string describe title in ${path} at its line`,
		[presetInstalled(), repositoryHas(invalidTestTitle(path))],
		function* ({ checks, reported }) {
			yield* checks();

			yield* assertThat(yield* reported("lint/nursery/useValidTestTitle"), (actual) => actual.toEqual([`${path}:3`]));
		},
	);
}
