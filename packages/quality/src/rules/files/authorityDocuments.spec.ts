import { otherNames } from "#rules/files/otherNames.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

ruleStory.it(
	"other-names accepts root authority documents beside AGENTS and still reports ordinary uppercase documents",
	[repositoryHas(...["AGENTS.md", "DESIGN.md", "ARCHITECTURE.md", "GLOSSARY.md", "ReleaseNotes.md"].map((path) => ({ content: "", path })))],
	function* ({ check, locations }) {
		yield* check(otherNames);

		yield* assertThat(yield* locations(), (actual) => actual.toEqual(["ReleaseNotes.md"]));
	},
);
