type Segment = RegExp | typeof GLOBSTAR;

const STAR = "*";

const GLOBSTAR = "**";

const DOT = ".";

const NO_DOT = "(?!\\.)";

const EXTGLOB = /[?*+@!]\(/u;

const BRACE_RANGE = /^[^,]*\.\.[^,]*$/u;

const REGEX_SYNTAX = /[\\^$.*+?()[\]{}|/]/u;

const CLASS_SYNTAX = /[\\\]^]/gu;

const BRACE_DEPTH = new Map([
	["{", 1],
	["}", -1],
]);

function depthChange(char: string | undefined): number {
	return BRACE_DEPTH.get(char ?? "") ?? 0;
}

function charSource(char: string): string {
	if (char === STAR) {
		return "[^/]*";
	}
	if (char === "?") {
		return "[^/]";
	}
	return REGEX_SYNTAX.test(char) ? `\\${char}` : char;
}

function unreadable(pattern: string, problem: string): Error {
	return new Error(`cannot read the workspace pattern "${pattern}": ${problem}`);
}

function closingBrace(text: string, open: number): number {
	let depth = 0;
	for (let index = open; index < text.length; index += 1) {
		depth += depthChange(text[index]);
		if (depth === 0) {
			return index;
		}
	}
	return -1;
}

function choices(body: string): readonly string[] {
	const parts = [""];
	let depth = 0;
	for (const char of body) {
		depth += depthChange(char);
		if (char === "," && depth === 0) {
			parts.push("");
		} else {
			parts[parts.length - 1] += char;
		}
	}
	return parts;
}

function expanded(pattern: string, whole: string): readonly string[] {
	const open = pattern.indexOf("{");
	if (open === -1) {
		return [pattern];
	}
	const close = closingBrace(pattern, open);
	if (close === -1) {
		throw unreadable(whole, "a { never closes");
	}
	const body = pattern.slice(open + 1, close);
	if (BRACE_RANGE.test(body)) {
		throw unreadable(whole, "brace ranges are not supported");
	}
	const options = choices(body);
	if (options.length < 2) {
		throw unreadable(whole, "a { } needs two or more choices");
	}
	return options.flatMap((option) => expanded(`${pattern.slice(0, open)}${option}${pattern.slice(close + 1)}`, whole));
}

function characterClass(segment: string, start: number, whole: string): { readonly end: number; readonly source: string } {
	const negated = segment[start + 1] === "!" || segment[start + 1] === "^";
	const first = start + (negated ? 2 : 1);
	const end = segment.indexOf("]", segment[first] === "]" ? first + 1 : first);
	if (end === -1) {
		throw unreadable(whole, "a [ never closes");
	}
	const body = segment.slice(first, end);
	if (body.includes("[:")) {
		throw unreadable(whole, "character class names are not supported");
	}
	return { end, source: `[${negated ? "^" : ""}${body.replace(CLASS_SYNTAX, "\\$&")}]` };
}

function segmentOf(segment: string, whole: string): Segment {
	if (segment === GLOBSTAR) {
		return GLOBSTAR;
	}
	if (EXTGLOB.test(segment)) {
		throw unreadable(whole, "extended globs are not supported");
	}
	let source = "";
	for (let index = 0; index < segment.length; index += 1) {
		const char = segment[index] ?? "";
		if (char === "[") {
			const found = characterClass(segment, index, whole);
			source += found.source;
			index = found.end;
		} else {
			source += charSource(char);
		}
	}
	return new RegExp(`^${segment.startsWith(DOT) ? "" : NO_DOT}${source}$`, "u");
}

function segmentsMatch(pattern: readonly Segment[], path: readonly string[]): boolean {
	const [first, ...rest] = pattern;
	if (first === undefined) {
		return path.length === 0;
	}
	if (first === GLOBSTAR) {
		const hidden = path.findIndex((segment) => segment.startsWith(DOT));
		const reachable = hidden === -1 ? path.length : hidden;
		return [...path.keys(), path.length].some((skipped) => skipped <= reachable && segmentsMatch(rest, path.slice(skipped)));
	}
	const [head, ...tail] = path;
	return head !== undefined && first.test(head) && segmentsMatch(rest, tail);
}

export function globMatcher(pattern: string): (path: string) => boolean {
	if (pattern.includes("\\")) {
		throw unreadable(pattern, "escapes are not supported");
	}
	const alternatives = expanded(pattern, pattern).map((alternative) => alternative.split("/").map((segment) => segmentOf(segment, pattern)));
	return (path) => alternatives.some((segments) => segmentsMatch(segments, path.split("/")));
}
