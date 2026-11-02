import ignore from "ignore";

export interface IgnoreMatcher {
	readonly ignores: (path: string) => boolean;
	readonly test: (path: string) => { readonly ignored: boolean; readonly unignored: boolean };
}

export function ignorePatterns(patterns: string | readonly string[]): IgnoreMatcher {
	const rules = ignore().add(typeof patterns === "string" ? patterns : [...patterns]);
	return { ignores: (path) => rules.ignores(path), test: (path) => rules.test(path) };
}

export function matchesIgnorePattern(file: string, glob: string): boolean {
	const result = ignorePatterns([glob]).test(file);
	return result.ignored || result.unignored;
}
