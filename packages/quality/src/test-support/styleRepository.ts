import { git } from "./git.ts";
import { config, linkPackage, seedTree } from "./tree.ts";

interface StyleSources {
	readonly arrays: string;
	readonly jsx: string;
	readonly nativeFixes?: boolean;
}

const NATIVE_FIXES = {
	rules: {
		style: {
			useConsistentArrayType: { fix: "unsafe", level: "error" },
			useConsistentCurlyBraces: { fix: "unsafe", level: "error" },
		},
	},
};

export function styleRepository({ arrays, jsx, nativeFixes = false }: StyleSources): string {
	const root = seedTree([
		config('{ sources: ["src"] }'),
		{ content: "node_modules/\n", path: ".gitignore" },
		{
			content: nativeFixes
				? JSON.stringify({ extends: ["@shivaedev/quality/biome"], linter: NATIVE_FIXES })
				: '{ "extends": ["@shivaedev/quality/biome"] }\n',
			path: "biome.json",
		},
		{ content: arrays, path: "src/arrays.ts" },
		{ content: jsx, path: "src/text.tsx" },
	]);
	linkPackage(root);
	git(root, "init", "--quiet");
	return root;
}
