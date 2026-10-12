import { git } from "./git.ts";
import { config, linkPackage, seedTree } from "./tree.ts";

export function generatedAuthored() {
	const root = seedTree([
		config('{ sources: ["src"] }'),
		{ content: '{ "extends": ["@shivaedev/quality/biome"] }', path: "biome.json" },
		{ content: "src/generated/\n", path: ".gitignore" },
		{
			content: `import "./missing.ts";\n// @ts-ignore\ndebugger;\nexport const actual = 1;\n${"\n".repeat(150)}`,
			path: "src/generated/WrongFolder/badName.ts",
		},
		{ content: "{}", path: "src/generated/BadNotes.json" },
		{ content: 'import "./untracked-missing.ts";\ndebugger;', path: "src/generated/output.ts" },
	]);
	linkPackage(root);
	git(root, "init", "--quiet");
	git(root, "add", "--force", "src/generated/WrongFolder/badName.ts", "src/generated/BadNotes.json");
	return root;
}
