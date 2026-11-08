import { Data, Result } from "effect";
import { DOT, GLOBSTAR, type Segment, segmentsMatch } from "#imports/segmentsMatch.ts";

export class GlobFailure extends Data.TaggedError("GlobFailure")<{
	readonly message: string;
}> {}

const STAR = "*";

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

function unreadable(pattern: string, problem: string): GlobFailure {
	return new GlobFailure({ message: `cannot read the workspace pattern "${pattern}": ${problem}` });
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

function expanded(pattern: string, whole: string): Result.Result<readonly string[], GlobFailure> {
	const open = pattern.indexOf("{");
	if (open === -1) {
		return Result.succeed([pattern]);
	}
	const close = closingBrace(pattern, open);
	if (close === -1) {
		return Result.fail(unreadable(whole, "a { never closes"));
	}
	const body = pattern.slice(open + 1, close);
	if (BRACE_RANGE.test(body)) {
		return Result.fail(unreadable(whole, "brace ranges are not supported"));
	}
	const options = choices(body);
	if (options.length < 2) {
		return Result.fail(unreadable(whole, "a { } needs two or more choices"));
	}
	return Result.map(Result.all(options.map((option) => expanded(`${pattern.slice(0, open)}${option}${pattern.slice(close + 1)}`, whole))), (found) =>
		found.flat(),
	);
}

function characterClass(
	segment: string,
	start: number,
	whole: string,
): Result.Result<{ readonly end: number; readonly source: string }, GlobFailure> {
	const negated = segment[start + 1] === "!" || segment[start + 1] === "^";
	const first = start + (negated ? 2 : 1);
	const end = segment.indexOf("]", segment[first] === "]" ? first + 1 : first);
	if (end === -1) {
		return Result.fail(unreadable(whole, "a [ never closes"));
	}
	const body = segment.slice(first, end);
	if (body.includes("[:")) {
		return Result.fail(unreadable(whole, "character class names are not supported"));
	}
	return Result.succeed({ end, source: `[${negated ? "^" : ""}${body.replace(CLASS_SYNTAX, "\\$&")}]` });
}

function segmentOf(segment: string, whole: string): Result.Result<Segment, GlobFailure> {
	if (segment === GLOBSTAR) {
		return Result.succeed(GLOBSTAR);
	}
	if (EXTGLOB.test(segment)) {
		return Result.fail(unreadable(whole, "extended globs are not supported"));
	}
	return Result.gen(function* () {
		let source = "";
		for (let index = 0; index < segment.length; index += 1) {
			const char = segment[index] ?? "";
			if (char === "[") {
				const found = yield* characterClass(segment, index, whole);
				source += found.source;
				index = found.end;
			} else {
				source += charSource(char);
			}
		}
		return yield* Result.try({
			catch: (cause) => new GlobFailure({ message: cause instanceof Error ? cause.message : String(cause) }),
			try: (): Segment => new RegExp(`^${segment.startsWith(DOT) ? "" : NO_DOT}${source}$`, "u"),
		});
	});
}

export function globMatcher(pattern: string): Result.Result<(path: string) => boolean, GlobFailure> {
	if (pattern.includes("\\")) {
		return Result.fail(unreadable(pattern, "escapes are not supported"));
	}
	return Result.gen(function* () {
		const options = yield* expanded(pattern, pattern);
		const alternatives = yield* Result.all(options.map((option) => Result.all(option.split("/").map((segment) => segmentOf(segment, pattern)))));
		return (path: string) => alternatives.some((segments) => segmentsMatch(segments, path.split("/")));
	});
}
