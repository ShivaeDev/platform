import { posix } from "node:path";
import { Effect, Order, Schema } from "effect";
import { type IgnoreMatcher, ignorePatterns } from "#adapters/ignore.ts";
import { GlobDeclarations, globPatterns, validateGlobs } from "#config/globs.ts";
import { routeFiles } from "#inventory/routeFiles.ts";
import { nativeNames } from "#naming/nativeNames.ts";
import { packageLayout } from "#naming/packageLayout.ts";
import { KEBAB, PASCAL } from "#naming/words.ts";
import { defineRule, type Finding } from "#rule.ts";

const SNAKE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/u;

const CODE = /\.[cm]?[jt]sx?$/u;

const FolderNamesOptions = Schema.Struct({
	content: GlobDeclarations,
	toolOwned: GlobDeclarations,
});

function foldersIn(files: readonly string[]): readonly string[] {
	const folders = new Set<string>();
	for (const file of files) {
		for (let folder = posix.dirname(file); folder !== "."; folder = posix.dirname(folder)) {
			folders.add(folder);
		}
	}
	return [...folders].sort(Order.String);
}

function stemsIn(files: readonly string[]): ReadonlySet<string> {
	return new Set(files.filter((file) => CODE.test(file)).map((file) => `${posix.dirname(file)}/${posix.basename(file).replace(CODE, "")}`));
}

function isModule(folder: string, stems: ReadonlySet<string>): boolean {
	const name = posix.basename(folder);
	return stems.has(`${folder}/${name}`) || stems.has(`${posix.dirname(folder)}/${name}`);
}

function packageMessage(name: string, packageName: string): string | undefined {
	const expected = packageName.replace(/^@[^/]+\//u, "");
	return name === expected ? undefined : `The folder of the package ${packageName} is named "${expected}", in kebab-case after the package name.`;
}

function groupMessage(name: string): string | undefined {
	if (PASCAL.test(name)) {
		return `"${name}" is PascalCase but holds no ${name}.ts or ${name}.tsx. A PascalCase folder is a module named after its main file: add that file, or name the folder in kebab-case.`;
	}
	return KEBAB.test(name.replace(/^\./u, ""))
		? undefined
		: `"${name}" groups files, so it is named in kebab-case, such as test-support/. A folder named after a file beside or inside it is a module and takes that file's name.`;
}

interface Context {
	readonly content: IgnoreMatcher;
	readonly names: ReadonlyMap<string, string>;
	readonly owned: ReadonlySet<string>;
	readonly stems: ReadonlySet<string>;
	readonly toolOwned: IgnoreMatcher;
}

function messageFor(folder: string, context: Context): string | undefined {
	const name = posix.basename(folder);
	if (context.owned.has(folder) || context.toolOwned.ignores(`${folder}/`) || isModule(folder, context.stems)) {
		return undefined;
	}
	const packageName = context.names.get(folder);
	if (packageName !== undefined) {
		return packageMessage(name, packageName);
	}
	if (context.content.ignores(`${folder}/`)) {
		return SNAKE.test(name) ? undefined : `"${name}" holds content, so it is named in snake_case, such as forest_path/.`;
	}
	return groupMessage(name);
}

export const folderNames = defineRule({
	check: ({ files, options, readText, root }) =>
		Effect.gen(function* () {
			const layout = yield* packageLayout({ files, readText });
			const routes = yield* routeFiles(root);
			const context: Context = {
				content: ignorePatterns([...globPatterns(options.content)]),
				names: layout.names,
				owned: new Set([...nativeNames(files).folders, ...routes.folders]),
				stems: stemsIn(files),
				toolOwned: ignorePatterns([...globPatterns(options.toolOwned)]),
			};
			return foldersIn(files).flatMap((folder): readonly Finding[] => {
				const message = messageFor(folder, context);
				return message === undefined ? [] : [{ file: folder, message }];
			});
		}),
	description:
		"A package folder is named after its package, a module folder after its main file, a content folder in snake_case and every other folder in kebab-case. TanStack Router configuration owns route folder names.",
	id: "files/folder-names",
	options: Schema.toStandardSchemaV1(FolderNamesOptions, { parseOptions: { errors: "all", onExcessProperty: "error" } }),
	validate: validateGlobs,
});
