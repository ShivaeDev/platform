import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { gitTracks, repositoryHas as importRepositoryHas } from "#test/importStory.ts";
import { repositoryStory } from "#test/repositoryStory.ts";
import { config, type SeedFile } from "#testing/adapters/tree.ts";

const GENERATED_NOTES = "src/generated/modules/notes/notes.ts";

const CREATE = "src/modules/notes/create.ts";

const OPERATION = `export class TitleTaken {\n\treadonly _tag = "TitleTaken";\n}\n\nexport function create(title: string): string | TitleTaken {\n\treturn title === "" ? new TitleTaken() : title;\n}\n`;

const GENERATOR_OUTPUT = "generator/notes.txt";

function manifest(generate: string): SeedFile {
	return {
		content: `{ "name": "notes-app", "private": true, "type": "module", "imports": { "#*.ts": "./src/*.ts" }, "scripts": { "generate": ${JSON.stringify(generate)} } }\n`,
		path: "package.json",
	};
}

// The layout a generator writes into: its output is git-ignored, only the README that names the command is tracked, and the generate script writes it.
export const generatedLayout: readonly SeedFile[] = [
	{ content: "node_modules/\nsrc/generated/*\n!src/generated/README.md\n", path: ".gitignore" },
	config('{ entries: ["src/modules/notes/notes.ts", "src/client/noteTitle.ts"], sources: ["src"] }'),
	manifest(`mkdir -p ${dirname(GENERATED_NOTES)} && cp ${GENERATOR_OUTPUT} ${GENERATED_NOTES}`),
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

export const generatorRefuses = manifest(
	"echo 'notes.create: run returns Map<string, number> at success, which has no exact wire form' >&2 && exit 1",
);

// A generator writes unformatted output on one line and imports through relative paths, which Quality would report in a checked file.
export function generatorWrites(...names: readonly string[]) {
	return repositoryStory.trait(
		"generation",
		`the generate script writes ${GENERATED_NOTES}, importing ${names.join(", ")} from ${CREATE}`,
		(engine) => {
			const path = join(engine.root, GENERATOR_OUTPUT);
			mkdirSync(dirname(path), { recursive: true });
			writeFileSync(
				path,
				`import { ${names.join(", ")} } from "../../../modules/notes/create.ts"; export const notesWire = { imported: [${names.join(", ")}] }; export const Notes = { name: "notes", wire: notesWire };`,
			);
		},
	);
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
