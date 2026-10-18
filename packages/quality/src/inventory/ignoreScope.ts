import { relative } from "node:path";
import ignore from "ignore";

export type Verdict = "ignored" | "kept" | "unknown";

interface IgnoreMatcher {
	readonly base: string;
	readonly rules: ReturnType<typeof ignore>;
}

export interface IgnoreScope {
	readonly boundary: string | undefined;
	readonly matchers: readonly IgnoreMatcher[];
}

export const emptyScope: IgnoreScope = { boundary: undefined, matchers: [] };

export function posix(path: string): string {
	return path.replaceAll("\\", "/");
}

export function withIgnoreFile(scope: IgnoreScope, base: string, contents: string): IgnoreScope {
	return {
		boundary: scope.boundary,
		matchers: [...scope.matchers, { base, rules: ignore().add(contents) }],
	};
}

// Re-including a directory resets directory rules below that boundary; filename rules still apply.
export function insideKept(scope: IgnoreScope, directory: string): IgnoreScope {
	return { boundary: directory, matchers: scope.matchers };
}

function matcherVerdict(matcher: IgnoreMatcher, boundary: string | undefined, path: string, directory: boolean): Verdict {
	const anchor = boundary !== undefined && boundary.length > matcher.base.length ? boundary : matcher.base;
	const rel = posix(relative(anchor, path));
	if (rel === "" || rel.startsWith("..")) {
		return "unknown";
	}
	// Directory-only patterns match paths with a trailing slash.
	const result = matcher.rules.test(directory ? `${rel}/` : rel);
	if (result.ignored) {
		return "ignored";
	}
	return result.unignored ? "kept" : "unknown";
}

export function verdictFor(scope: IgnoreScope, path: string, directory: boolean): Verdict {
	return (
		scope.matchers.map((matcher) => matcherVerdict(matcher, scope.boundary, path, directory)).findLast((verdict) => verdict !== "unknown")
		?? "unknown"
	);
}
