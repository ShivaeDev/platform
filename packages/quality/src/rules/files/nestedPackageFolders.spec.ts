import { folderNames } from "#rules/files/folderNames.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

for (const [folder, name] of [
	["packages/glass/client", "@antumbra/glass-client"],
	["packages/glass/render/dom", "@antumbra/glass-render-dom"],
	["modules/glass/client", "@antumbra/glass-client"],
	["packages/glass/client", "glass-client"],
	["packages/glass/glass-client", "@antumbra/glass-client"],
	["packages/quality", "@shivaedev/quality"],
	["packages/service", "@shivaedev/service"],
] as const) {
	ruleStory.it(
		`files/folder-names accepts ${name} in ${folder}`,
		[repositoryHas({ content: JSON.stringify({ name }), path: `${folder}/package.json` })],
		function* ({ check, findings }) {
			yield* check(folderNames);

			yield* assertThat(yield* findings(), (actual) => actual.toEqual([]));
		},
	);
}

for (const [folder, name, unscoped] of [
	["packages/glass/server", "@antumbra/glass-client", "glass-client"],
	["packages/other/glass/client", "@antumbra/glass-client", "glass-client"],
	["packages/glass/client", "@antumbra/packages-glass-client", "packages-glass-client"],
] as const) {
	ruleStory.it(
		`files/folder-names reports ${name} in ${folder} with both accepted forms`,
		[repositoryHas({ content: JSON.stringify({ name }), path: `${folder}/package.json` })],
		function* ({ check, findings }) {
			yield* check(folderNames);

			yield* assertThat(yield* findings(), (actual) =>
				actual.toEqual([
					{
						file: folder,
						message: `The folder of the package ${name} must be named "${unscoped}", in kebab-case after the package name, or its path below the workspace package root must join with "-" to "${unscoped}".`,
					},
				]),
			);
		},
	);
}
