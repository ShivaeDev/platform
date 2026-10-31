import { expect } from "vitest";
import { otherNames } from "#rules/files/otherNames.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const CONTENT = { content: ["content/"] };

const misnamed = [
	["a PascalCase document", "docs/ReleaseNotes.md", undefined, '"ReleaseNotes.md" is named in kebab-case, such as release-notes.md.'],
	["a snake_case image", "assets/Logo_Dark.png", undefined, '"Logo_Dark.png" is named in kebab-case, such as release-notes.md.'],
	[
		"a camelCase GritQL file",
		"biome/plugins/effectFnSpans.grit",
		undefined,
		'"effectFnSpans.grit" is named in kebab-case, such as release-notes.md.',
	],
	[
		"a PascalCase Prisma schema",
		"prisma/Schema.prisma",
		undefined,
		'"Schema.prisma" is a Prisma schema, so it is named in camelCase, such as schema.prisma.',
	],
	[
		"a kebab-case content file",
		"content/forest-path.json",
		CONTENT,
		'"forest-path.json" is content, so it is named in snake_case, such as forest_path.json',
	],
	[
		"a content id joined by three underscores",
		"content/forest_path___clearing.json",
		CONTENT,
		'"forest_path___clearing.json" is content, so it is named in snake_case',
	],
] as const;

for (const [file, path, options, reason] of misnamed) {
	ruleStory.it(`files/other-names reports ${file}: ${reason}`, [repositoryHas({ content: "", path })], function* ({ check, messages }) {
		yield* check(otherNames, options);

		expect(yield* messages()).toEqual([expect.stringContaining(reason)]);
	});
}

const named = [
	["the conventional README.md", "README.md", undefined],
	["the conventional CHANGELOG.md", "CHANGELOG.md", undefined],
	["a kebab-case document", "docs/release-notes.md", undefined],
	["a dotted kebab-case document", "docs/release.notes.md", undefined],
	["a kebab-case image", "assets/logo-dark.svg", undefined],
	["a kebab-case GritQL file", "biome/plugins/effect-fn-spans.grit", undefined],
	["a camelCase Prisma schema", "prisma/schema.prisma", undefined],
	["a snake_case content file", "content/forest_path.json", CONTENT],
	["a content id joined by two underscores", "content/forest_path__clearing.json", CONTENT],
	["the tool-owned dotfile .prettierrc.json", ".prettierrc.json", undefined],
] as const;

for (const [file, path, options] of named) {
	ruleStory.it(`files/other-names accepts ${file}`, [repositoryHas({ content: "", path })], function* ({ check }) {
		expect(yield* check(otherNames, options)).toEqual([]);
	});
}
