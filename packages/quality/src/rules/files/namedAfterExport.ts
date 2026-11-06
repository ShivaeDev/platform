import { posix } from "node:path";
import { Effect, Schema } from "effect";
import { ignorePatterns } from "#adapters/ignore.ts";
import { isToolConfig } from "#adapters/isToolConfig.ts";
import { serviceAssemblyImports } from "#adapters/serviceAssemblyImports.ts";
import { directServiceDefinitions } from "#adapters/serviceAssemblySyntax.ts";
import { GlobDeclarations, globPatterns, validateGlobs } from "#config/globs.ts";
import { programmaticEntries } from "#inventory/programmaticEntries.ts";
import { routeFiles } from "#inventory/routeFiles.ts";
import { exportFits } from "#naming/exportFits.ts";
import { mainExport } from "#naming/mainExport.ts";
import { isMigrationFile } from "#naming/migrationFile.ts";
import { moduleRoot } from "#naming/moduleRoot.ts";
import { ownDeclarations, ownExports } from "#naming/ownExports.ts";
import { type PackageLayout, packageLayout } from "#naming/packageLayout.ts";
import { CAMEL, KEBAB, sameWord, wordsOf } from "#naming/words.ts";
import { defineRule, type Finding, type SourceFile } from "#rule.ts";
import { parse } from "#rules/parse.ts";

const DEFAULT_TOOL_OWNED: readonly string[] = ["*.d.ts", "*.d.mts", "*.d.cts"];

const TEST = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;

const SHEBANG = "#!";

const SHAPES =
	"The file name and the names of its folders spell the export, in any order, and the file's first letter follows the export's case: listItems in items/ is items/list.ts, ItemPanel is ItemPanel.tsx or item/Panel.tsx.";

const NamedAfterExportOptions = Schema.Struct({
	toolOwned: GlobDeclarations,
});

function stemOf(path: string): string {
	return posix.basename(path).replace(/\.[^.]+$/u, "");
}

function repeated(stem: string, folders: readonly string[]): string | undefined {
	if (folders.at(-1) === stem) {
		return undefined;
	}
	const words = wordsOf(stem);
	return folders.find((folder) => wordsOf(folder).some((word) => words.some((own) => sameWord(own, word))));
}

function nameFinding(file: SourceFile, stem: string, folders: readonly string[]): string | undefined {
	const source = parse(file);
	const exports = source === undefined ? [] : ownExports(source);
	const constants = source === undefined ? [] : ownDeclarations(source).filter((entry) => entry.constant);
	if (constants.some((entry) => exportFits(entry.name, stem, folders))) {
		return undefined;
	}
	const [only] = exports;
	if (only === undefined) {
		return CAMEL.test(stem)
			? undefined
			: `"${stem}" exports nothing, so it is named in camelCase, such as setupTests.ts. A file that a package.json script or bin runs is kebab-case.`;
	}
	if (exports.some((entry) => exportFits(entry.name, stem, folders))) {
		return undefined;
	}
	const main = mainExport(exports);
	if (main !== undefined) {
		return `"${stem}" does not name its export ${main.name}. ${SHAPES} Rename the file or the export.`;
	}
	return CAMEL.test(stem)
		? undefined
		: `"${stem}" exports several things, so it is a topic file named in camelCase, such as limits.ts. Or split it so each file has one main export. ${SHAPES}`;
}

function findingsOf(file: SourceFile, layout: PackageLayout): readonly Finding[] {
	const source = posix.basename(file.path) === "service.ts" ? parse(file) : undefined;
	if (source !== undefined && directServiceDefinitions(source, serviceAssemblyImports(source).definitions).length > 0) {
		return [];
	}
	const stem = stemOf(file.path);
	const folders = layout.foldersOf(file.path);
	if (layout.scripts.has(file.path) || file.text.startsWith(SHEBANG)) {
		return KEBAB.test(stem)
			? []
			: [
					{
						file: file.path,
						message: `"${stem}" is run as a script, so it is named in kebab-case, such as build-docs.ts.`,
					},
				];
	}
	const root = moduleRoot(file.path);
	const admin = root === undefined ? undefined : /^(?:client|server)\/(?<path>admin\/.+)$/u.exec(file.path.slice(root.length + 1))?.groups?.path;
	const folder = repeated(stem, admin === undefined ? folders : posix.dirname(admin).split("/"));
	const messages = [
		nameFinding(file, stem, folders),
		folder === undefined ? undefined : `"${stem}" repeats its folder "${folder}". The folder is the prefix: items/listItems.ts is items/list.ts.`,
	];
	return messages.flatMap((message) => (message === undefined ? [] : [{ file: file.path, message }]));
}

export const namedAfterExport = defineRule({
	check: (inputs) =>
		Effect.gen(function* () {
			const { options, root, sources } = inputs;
			const layout = yield* packageLayout(inputs);
			const entries = yield* programmaticEntries(inputs);
			const routes = yield* routeFiles(root);
			const toolOwned = ignorePatterns([...DEFAULT_TOOL_OWNED, ...globPatterns(options.toolOwned)]);
			return sources
				.filter(
					(file) =>
						!(
							entries.has(file.path)
							|| isToolConfig(file.path)
							|| TEST.test(file.path)
							|| isMigrationFile(file.path)
							|| routes.files.has(file.path)
							|| toolOwned.ignores(file.path)
						),
				)
				.flatMap((file) => findingsOf(file, layout));
		}),
	description:
		"A file is named after its main export or a module-level constant, including a private constant, with its folders as the prefix; module client/admin and server/admin files may repeat names from above the admin folder. defineService declarations use service.ts; TanStack Router configuration owns route filenames; programmatic bundler entries and tool configs keep their role names. A file of several exports is a camelCase topic file, and a script is kebab-case. Rename the file or the export; nothing renames them for you.",
	id: "files/named-after-export",
	options: Schema.toStandardSchemaV1(NamedAfterExportOptions, {
		parseOptions: { errors: "all", onExcessProperty: "error" },
	}),
	validate: validateGlobs,
});
