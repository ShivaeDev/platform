import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { gitTracks, repositoryHas as importRepositoryHas } from "#test/importStory.ts";
import { repositoryStory } from "#test/repositoryStory.ts";
import { config, type SeedFile } from "#testing/adapters/tree.ts";

const GENERATED_NOTES = "src/generated/modules/notes/notes.ts";

const CREATE = "src/modules/notes/create.ts";

const OPERATION = `export class TitleTaken {\n\treadonly _tag = "TitleTaken";\n}\n\nexport function create(title: string): string | TitleTaken {\n\treturn title === "" ? new TitleTaken() : title;\n}\n`;

// The layout a generator writes into: its output is git-ignored, and only the README that names the command is tracked.
export const generatedLayout: readonly SeedFile[] = [
	{ content: "node_modules/\nsrc/generated/*\n!src/generated/README.md\n", path: ".gitignore" },
	config(
		'{ entries: ["src/modules/notes/notes.ts", "src/client/noteTitle.ts"], rules: { "imports/resolvable": { options: { generated: ["src/generated"] } } }, sources: ["src"] }',
	),
	{
		content: '{ "name": "notes-app", "private": true, "type": "module", "imports": { "#*.ts": "./src/*.ts" } }\n',
		path: "package.json",
	},
	{ content: "Written by `pnpm generate`. Run it after a fresh checkout.\n", path: "src/generated/README.md" },
	{ content: OPERATION, path: CREATE },
	{
		content:
			'import { notesWire } from "#generated/modules/notes/notes.ts";\nimport { create } from "#modules/notes/create.ts";\n\nexport const notes = { operations: [create], wire: notesWire };\n',
		path: "src/modules/notes/notes.ts",
	},
	{
		content: 'import { Notes } from "#generated/modules/notes/notes.ts";\n\nexport function noteTitle(): string {\n\treturn Notes.name;\n}\n',
		path: "src/client/noteTitle.ts",
	},
];

export const titleLimitExported: SeedFile = { content: `export const MAX_TITLE_LENGTH = 80;\n\n${OPERATION}`, path: CREATE };

// A generator writes unformatted output on one line and imports through relative paths, which Quality would report in a checked file.
export function generatorWrote(...names: readonly string[]) {
	return repositoryStory.trait("generation", `the generator wrote ${GENERATED_NOTES}, importing ${names.join(", ")} from ${CREATE}`, (engine) => {
		const path = join(engine.root, GENERATED_NOTES);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(
			path,
			`import { ${names.join(", ")} } from "../../../modules/notes/create.ts"; export const notesWire = { imported: [${names.join(", ")}] }; export const Notes = { name: "notes", wire: notesWire };`,
		);
	});
}

const SERVER_LAYOUT: readonly SeedFile[] = [
	{ content: "node_modules/\nsrc/generated/*\n!src/generated/README.md\n", path: ".gitignore" },
	{ content: JSON.stringify({ imports: { "#*.ts": "./src/*.ts" }, name: "notes-app", private: true, type: "module" }), path: "package.json" },
	{ content: "Written by `pnpm generate`.\n", path: "src/generated/README.md" },
	{ content: 'import { Notes } from "#generated/modules/notes/notes.ts";\n\nexport const title = Notes.name;\n', path: "src/client/noteTitle.ts" },
	{ content: 'export const notesRepository = { table: "notes" };\n', path: "src/modules/notes/server/notesRepository.ts" },
	{
		content: 'import { notesRepository } from "#modules/notes/server/notesRepository.ts";\n\nexport const Notes = { name: notesRepository.table };\n',
		path: GENERATED_NOTES,
	},
];

export const generatedServerImport = [
	importRepositoryHas(...SERVER_LAYOUT),
	gitTracks(...SERVER_LAYOUT.flatMap((file) => (file.path === GENERATED_NOTES ? [] : [file.path]))),
];
