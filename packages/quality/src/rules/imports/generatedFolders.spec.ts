import { importsResolvable } from "#rules/imports/resolvable.ts";
import { definedModuleWorkspace, generatorWrote, NOTES_GENERATED } from "#test/definedModules.ts";
import { fixtureTree } from "#test/fixtureTree.ts";
import { importStory, repositoryHas, repositoryHolds } from "#test/importStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

importStory.it(
	"imports/resolvable reports an import of a file in the application's src/generated that the generator does not write, naming the module that would define it",
	[repositoryHolds(fixtureTree("unresolvable"))],
	function* ({ check, messages }) {
		yield* check(importsResolvable);

		yield* assertThat(yield* messages(), (actual) =>
			actual.toContain(
				'Cannot resolve "./generated/client.ts". The project\'s generate script writes src/generated/client.ts only when src/client.ts defines a module. Fix the path, or define the module there.',
			),
		);
	},
);

importStory.it(
	"imports/resolvable accepts another workspace package's import of a generated client the generator wrote, and reports one of a module that does not exist",
	[
		...definedModuleWorkspace,
		generatorWrote("type"),
		repositoryHas({
			content: 'import { Drafts } from "@acme/notes/generated/Drafts.ts";\n\nexport const drafts = Drafts;\n',
			path: "packages/ui/src/drafts.ts",
		}),
	],
	function* ({ check, findings }) {
		yield* check(importsResolvable);

		yield* assertThat(yield* findings(), (actual) =>
			actual.toEqual([
				{
					file: "packages/ui/src/drafts.ts",
					line: 1,
					message: `Cannot resolve "@acme/notes/generated/Drafts.ts". The project's generate script writes ${NOTES_GENERATED}/Drafts.ts only when packages/notes/src/Drafts.ts defines a module. Fix the path, or define the module there.`,
					subject: "@acme/notes/generated/Drafts.ts",
				},
			]),
		);
	},
);
