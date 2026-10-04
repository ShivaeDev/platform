import { posix } from "node:path";
import { Effect, Schema } from "effect";
import ignore, { type Ignore } from "ignore";
import { packageLayout } from "#naming/packageLayout.ts";
import { KEBAB, PASCAL } from "#naming/words.ts";
import { defineRule, type Finding } from "#rule.ts";

const DEFAULT_TOOL_OWNED: readonly string[] = ["generated/", "migrations/"];

const SNAKE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/u;

const CODE = /\.[cm]?[jt]sx?$/u;

const FolderNamesOptions = Schema.Struct({
	content: Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
	toolOwned: Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultKey(Effect.succeed(DEFAULT_TOOL_OWNED))),
});

function foldersIn(files: readonly string[]): readonly string[] {
	const folders = new Set<string>();
	for (const file of files) {
		for (let folder = posix.dirname(file); folder !== "."; folder = posix.dirname(folder)) {
			folders.add(folder);
		}
	}
	return [...folders].sort();
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
	readonly content: Ignore;
	readonly names: ReadonlyMap<string, string>;
	readonly stems: ReadonlySet<string>;
	readonly toolOwned: Ignore;
}

function messageFor(folder: string, context: Context): string | undefined {
	const name = posix.basename(folder);
	if (context.toolOwned.ignores(`${folder}/`) || isModule(folder, context.stems)) {
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
	check: async ({ files, options, readText }) => {
		const layout = await packageLayout({ files, readText });
		const context: Context = {
			content: ignore().add([...options.content]),
			names: layout.names,
			stems: stemsIn(files),
			toolOwned: ignore().add([...options.toolOwned]),
		};
		return foldersIn(files).flatMap((folder): readonly Finding[] => {
			const message = messageFor(folder, context);
			return message === undefined ? [] : [{ file: folder, message }];
		});
	},
	description:
		"A package folder is named after its package, a module folder after its main file, a content folder in snake_case and every other folder in kebab-case.",
	id: "files/folder-names",
	options: Schema.toStandardSchemaV1(FolderNamesOptions, { parseOptions: { errors: "all", onExcessProperty: "error" } }),
});
