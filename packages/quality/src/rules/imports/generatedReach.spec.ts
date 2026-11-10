import { fence } from "#imports/fence.ts";
import { external, folders } from "#imports/fences/selectors.ts";
import { importFences } from "#rules/imports/fences.ts";
import { importsRuntime } from "#rules/imports/runtime.ts";
import { generatedServerImport } from "#test/generatedOutput.ts";
import { importStory } from "#test/importStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

importStory.it(
	"imports/runtime reports the client file whose generated import reaches server code, naming the chain, and nothing in the generated file",
	generatedServerImport,
	function* ({ check }) {
		const findings = yield* check(importsRuntime);

		yield* assertThat(findings, (actual) =>
			actual.toEqual([
				{
					file: "src/client/noteTitle.ts",
					line: 1,
					message:
						'Client code reaches server code through "#generated/modules/notes/notes.ts", which git ignores: src/generated/modules/notes/notes.ts -> src/modules/notes/server/notesRepository.ts. Move runtime-dependent code into src/client/ or src/server/ and keep shared code independent of both runtimes.',
					subject: "#generated/modules/notes/notes.ts",
				},
			]),
		);
	},
);

importStory.it(
	"imports/fences reports the client file that reaches server code through generated output, naming the chain, and nothing in the generated file",
	generatedServerImport,
	function* ({ check }) {
		const clientStaysOffServer = fence("client-stays-off-server")
			.because("The client ships to browsers.")
			.from(folders("src/client"))
			.mayNotReach(folders("src/modules/notes/server"))
			.demonstratedBy({
				illegal: ["src/client/noteTitle.ts", "src/modules/notes/server/notesRepository.ts"],
				legal: ["src/client/noteTitle.ts", external("effect")],
			});

		const findings = yield* check(importFences, { fences: [clientStaysOffServer] });

		yield* assertThat(findings, (actual) =>
			actual.toEqual([
				{
					file: "src/client/noteTitle.ts",
					line: 1,
					message:
						'Reaches src/modules/notes/server/notesRepository.ts through src/client/noteTitle.ts -> src/generated/modules/notes/notes.ts -> src/modules/notes/server/notesRepository.ts across the fence "client-stays-off-server": The client ships to browsers.',
					subject: "client-stays-off-server",
				},
			]),
		);
	},
);
