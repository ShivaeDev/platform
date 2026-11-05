import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";
import { SKILL_EXAMPLE, SKILL_MANIFEST } from "#test/skillDistribution.ts";
import { syncedSkills } from "#test/syncedSkills.ts";
import { assertThat, withMatchers } from "#testing/adapters/assertThat.ts";

for (const directory of [".", "apps/site"]) {
	const prefix = directory === "." ? "" : `${directory}/`;
	for (const command of [["fix"], ["fix", "--rule", "react/jsx-conditionals"]]) {
		repositoryStory.it(
			`quality ${command.join(" ")} leaves skills synced in ${directory} intact and fixes authored JSX`,
			[qualityInstalled(), syncedSkills(directory), repositoryHas({ content: SKILL_EXAMPLE, path: ".agents/skills/guide-local/View.tsx" })],
			function* ({ outcome, reads, runs, skillsStatus }) {
				yield* assertThat(yield* reads(".agents/skills/guide-local/View.tsx"), (actual) => actual.toBe(SKILL_EXAMPLE));

				yield* runs(...command);

				yield* withMatchers((expect) =>
					outcomes([
						["shared JSX", () => reads(`${prefix}.agents/skills/guide/examples/View.tsx`), SKILL_EXAMPLE],
						["shared manifest", () => reads(`${prefix}.agents/skills/guide/package.json`), SKILL_MANIFEST],
						[
							"local JSX",
							() => reads(".agents/skills/guide-local/View.tsx"),
							expect.stringContaining(command.length === 1 ? "</div>;" : "const qualityContent = ready && <b />;"),
						],
						["fix", () => outcome(), "passed"],
						["skills check", () => skillsStatus(), "in sync"],
					]),
				);
			},
		);
	}
}

repositoryStory.it(
	"quality lint skips synced skill copies and still reports a local skill beside them",
	[
		qualityInstalled(),
		syncedSkills(),
		repositoryHas(
			{ content: "export const value = 1;\n", path: "src/value.ts" },
			{ content: "// TODO: finish the local guide\nexport const value = 1;\n", path: ".agents/skills/guide-local/example.ts" },
		),
	],
	function* ({ runs, stdout }) {
		yield* runs("lint");

		yield* assertThat(yield* stdout(), (actual) => {
			actual.toContain(".agents/skills/guide-local/example.ts");
			actual.not.toContain(".agents/skills/guide/");
			actual.not.toContain(".claude/skills/guide/");
		});
	},
);
