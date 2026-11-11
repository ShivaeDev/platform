import { gitTracks, repositoryHas, workspaceInstalled } from "#test/importStory.ts";
import type { SeedFile } from "#testing/adapters/tree.ts";

export const NOTES_GENERATED = "packages/notes/src/generated";

const GENERATED_CLIENT = `${NOTES_GENERATED}/Notes.ts`;

function manifest(name: string): string {
	return JSON.stringify({ exports: { "./*.ts": "./src/*.ts" }, imports: { "#*.ts": "./src/*.ts" }, name, private: true, type: "module" });
}

// A package with a defined module, the generated folder its client is written to, and a second package whose page imports that client.
const WORKSPACE: readonly SeedFile[] = [
	{ content: JSON.stringify({ name: "shop", private: true, workspaces: ["packages/*"] }), path: "package.json" },
	{ content: "node_modules/\n**/src/generated/*\n!**/src/generated/README.md\n", path: ".gitignore" },
	{ content: manifest("@shivaedev/contract"), path: "packages/contract/package.json" },
	{
		content: "export function defineModule<TModule>(module: TModule): TModule {\n\treturn module;\n}\n",
		path: "packages/contract/src/defineModule.ts",
	},
	{ content: manifest("@acme/notes"), path: "packages/notes/package.json" },
	{ content: 'export const notesRepository = { table: "notes" };\n', path: "packages/notes/src/server/repository.ts" },
	{ content: 'export const noteKeys = { list: "notes" };\n', path: "packages/notes/src/keys.ts" },
	{
		content:
			'import { defineModule } from "@shivaedev/contract/defineModule.ts";\nimport { notesWire } from "#generated/Notes.ts";\nimport { notesRepository } from "#server/repository.ts";\n\nexport const Notes = defineModule({ name: notesRepository.table, wire: notesWire });\n',
		path: "packages/notes/src/Notes.ts",
	},
	{ content: "Written by `pnpm generate`.\n", path: `${NOTES_GENERATED}/README.md` },
	{ content: manifest("@acme/ui"), path: "packages/ui/package.json" },
	{ content: 'import { Notes } from "@acme/notes/generated/Notes.ts";\n\nexport const page = Notes.name;\n', path: "packages/ui/src/page.ts" },
];

export const definedModuleWorkspace = [
	repositoryHas(...WORKSPACE),
	workspaceInstalled("@shivaedev/contract", "packages/contract"),
	workspaceInstalled("@acme/notes", "packages/notes"),
	gitTracks(...WORKSPACE.map((file) => file.path)),
];

const MODULE_IMPORT = {
	type: 'import type { Notes as NotesModule } from "#Notes.ts";',
	value: 'import { Notes as NotesModule } from "#Notes.ts";',
};

// The generated client checks its type against the module it is generated from; the generator writes it after checkout, so git ignores it.
export function generatorWrote(moduleImport: keyof typeof MODULE_IMPORT) {
	return repositoryHas({
		content: `${MODULE_IMPORT[moduleImport]}\nimport { noteKeys } from "#keys.ts";\n\nexport const notesWire = { list: noteKeys.list };\nexport const Notes = { name: "notes", wire: notesWire };\nexport type Matches = typeof NotesModule;\n`,
		path: GENERATED_CLIENT,
	});
}
