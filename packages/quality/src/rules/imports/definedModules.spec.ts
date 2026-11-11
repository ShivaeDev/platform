import { fence } from "#imports/fence.ts";
import { external, folders } from "#imports/fences/selectors.ts";
import { importFences } from "#rules/imports/fences.ts";
import { importsRuntime } from "#rules/imports/runtime.ts";
import { definedModuleWorkspace, generatorWrote, NOTES_GENERATED } from "#test/definedModules.ts";
import { emptyFolders, generatedDeclared, importStory, repositoryHas } from "#test/importStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

const REPAIR = "Move runtime-dependent code into src/client/ or src/server/ and keep shared code independent of both runtimes.";

importStory.it(
	"imports/runtime takes a file that calls defineModule as server code: its server imports pass, a client import of it is reported, and a shared file importing server code still is",
	[
		...definedModuleWorkspace,
		repositoryHas(
			{ content: 'import { Notes } from "#Notes.ts";\n\nexport const name = Notes.name;\n', path: "packages/notes/src/client/notesView.ts" },
			{
				content: 'import { notesRepository } from "#server/repository.ts";\n\nexport const titles = notesRepository.table;\n',
				path: "packages/notes/src/titles.ts",
			},
		),
	],
	function* ({ check }) {
		const findings = yield* check(importsRuntime);

		yield* assertThat(findings, (actual) =>
			actual.toEqual([
				{
					file: "packages/notes/src/client/notesView.ts",
					line: 1,
					message:
						'Client code imports a defined module, which is server code, through "#Notes.ts". Import the module\'s generated client from its generated folder instead; it holds no server code.',
					subject: "#Notes.ts",
				},
				{
					file: "packages/notes/src/titles.ts",
					line: 1,
					message: `Shared code imports server code through "#server/repository.ts". ${REPAIR}`,
					subject: "#server/repository.ts",
				},
			]),
		);
	},
);

importStory.it(
	"imports/runtime lets shared code import a generated client whose only import of its server module is a type import",
	[...definedModuleWorkspace, generatorWrote("type"), generatedDeclared(NOTES_GENERATED), emptyFolders("packages/ui/src/client")],
	function* ({ check }) {
		yield* assertThat(yield* check(importsRuntime), (actual) => actual.toEqual([]));
	},
);

const UI_STAYS_OFF_SERVER = fence("ui-stays-off-notes-server")
	.because("The ui ships to browsers.")
	.from(folders("packages/ui/src"))
	.mayNotReach(folders("packages/notes/src/server"))
	.demonstratedBy({
		illegal: ["packages/ui/src/page.ts", "packages/notes/src/server/repository.ts"],
		legal: ["packages/ui/src/page.ts", external("effect")],
	});

importStory.it(
	"imports/fences does not follow a generated client's type import of its own module across another package's fence",
	[...definedModuleWorkspace, generatorWrote("type"), generatedDeclared(NOTES_GENERATED)],
	function* ({ check }) {
		yield* assertThat(yield* check(importFences, { fences: [UI_STAYS_OFF_SERVER] }), (actual) => actual.toEqual([]));
	},
);

importStory.it(
	"imports/fences reports the page whose generated client imports its module as a value, naming the chain to server code",
	[...definedModuleWorkspace, generatorWrote("value"), generatedDeclared(NOTES_GENERATED)],
	function* ({ check, messages }) {
		yield* check(importFences, { fences: [UI_STAYS_OFF_SERVER] });

		yield* assertThat(yield* messages(), (actual) =>
			actual.toEqual([
				`Reaches packages/notes/src/server/repository.ts through packages/ui/src/page.ts -> ${NOTES_GENERATED}/Notes.ts -> packages/notes/src/Notes.ts -> packages/notes/src/server/repository.ts across the fence "ui-stays-off-notes-server": The ui ships to browsers.`,
			]),
		);
	},
);
