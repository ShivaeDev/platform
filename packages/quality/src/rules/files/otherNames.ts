import { posix } from "node:path";
import { Effect, Schema } from "effect";
import ignore, { type Ignore } from "ignore";
import { CAMEL, KEBAB } from "#naming/words.ts";
import { defineRule, type Finding, type SourceFile } from "#rule.ts";

const DEFAULT_TOOL_OWNED: readonly string[] = [
	".*",
	"package.json",
	"tsconfig*.json",
	"biome.json",
	"biome.jsonc",
	"*.config.*",
	"migrations/",
	"generated/",
];

const CONVENTIONAL: ReadonlySet<string> = new Set(["AGENTS", "CHANGELOG", "CLAUDE", "CONTRIBUTING", "LICENSE", "README", "SECURITY", "SKILL"]);

const KEBAB_KINDS: ReadonlySet<string> = new Set([
	"avif",
	"gif",
	"grit",
	"ico",
	"jpeg",
	"jpg",
	"json",
	"jsonc",
	"md",
	"mdx",
	"otf",
	"png",
	"svg",
	"ttf",
	"webp",
	"woff",
	"woff2",
]);

const STYLESHEETS: ReadonlySet<string> = new Set(["css", "scss"]);

const DOTTED_KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)*$/u;

const SNAKE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/u;

const STYLESHEET_IMPORT = /["'](?<stylesheet>\.{1,2}\/[^"'\n]+\.s?css)["']/gu;

const CODE = /\.[cm]?[jt]sx?$/u;

const OtherNamesOptions = Schema.Struct({
	content: Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
	toolOwned: Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultKey(Effect.succeed(DEFAULT_TOOL_OWNED))),
});

function importers(sources: readonly SourceFile[]): ReadonlyMap<string, readonly string[]> {
	const found = new Map<string, string[]>();
	for (const source of sources) {
		for (const match of source.text.matchAll(STYLESHEET_IMPORT)) {
			const target = posix.normalize(posix.join(posix.dirname(source.path), match.groups?.stylesheet ?? ""));
			found.set(target, [...new Set([...(found.get(target) ?? []), source.path])]);
		}
	}
	return found;
}

function stylesheetMessage(path: string, stem: string, importedBy: readonly string[]): string | undefined {
	const [only] = importedBy;
	if (importedBy.length === 1 && only !== undefined) {
		const owner = posix.basename(only).replace(CODE, "");
		return stem === owner ? undefined : `"${stem}" is styling for ${posix.basename(only)} alone, so it is named ${owner}${posix.extname(path)}.`;
	}
	return KEBAB.test(stem) ? undefined : `"${stem}" is a shared stylesheet, so it is named in kebab-case, such as form-controls.css.`;
}

interface Context {
	readonly content: Ignore;
	readonly stylesheets: ReadonlyMap<string, readonly string[]>;
	readonly toolOwned: Ignore;
}

function messageFor(path: string, context: Context): string | undefined {
	const name = posix.basename(path);
	const kind = posix.extname(name).slice(1);
	const stem = name.slice(0, name.length - kind.length - 1);
	if (kind === "" || context.toolOwned.ignores(path) || CONVENTIONAL.has(stem)) {
		return undefined;
	}
	if (context.content.ignores(path)) {
		return SNAKE.test(stem) ? undefined : `"${name}" is content, so it is named in snake_case, such as forest_path.json.`;
	}
	if (STYLESHEETS.has(kind)) {
		return stylesheetMessage(path, stem, context.stylesheets.get(path) ?? []);
	}
	if (kind === "prisma") {
		return CAMEL.test(stem) ? undefined : `"${name}" is a Prisma schema, so it is named in camelCase, such as schema.prisma.`;
	}
	return KEBAB_KINDS.has(kind) && !DOTTED_KEBAB.test(stem)
		? `"${name}" is named in kebab-case, such as release-notes.md. Only conventional names such as README.md and CHANGELOG.md are upper case.`
		: undefined;
}

export const otherNames = defineRule({
	check: ({ files, options, sources }) => {
		const context: Context = {
			content: ignore().add([...options.content]),
			stylesheets: importers(sources),
			toolOwned: ignore().add([...options.toolOwned]),
		};
		return files.flatMap((path): readonly Finding[] => {
			const message = messageFor(path, context);
			return message === undefined ? [] : [{ file: path, message }];
		});
	},
	description:
		"Documents, data, assets and GritQL files are kebab-case, a stylesheet that one component imports is named after it, a Prisma schema is camelCase and content is snake_case.",
	id: "files/other-names",
	options: Schema.toStandardSchemaV1(OtherNamesOptions, { parseOptions: { errors: "all", onExcessProperty: "error" } }),
});
