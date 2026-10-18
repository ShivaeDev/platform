import { matchesGlob } from "node:path";

export function matchesAny(path: string, patterns: readonly string[]): boolean {
	return patterns.some((pattern) => matchesGlob(path, pattern));
}
