import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { globMatcher } from "#imports/globMatcher.ts";
import type { Finding, RuleContext } from "#rule.ts";

export interface ForbiddenCharacter {
	readonly codePoint?: number | undefined;
	readonly message?: string | undefined;
	readonly range?: readonly [number, number] | undefined;
	readonly replacement?: string | undefined;
}

export interface AsciiOptions {
	readonly files: readonly string[];
	readonly forbidden?: readonly ForbiddenCharacter[] | undefined;
}

function forbiddenLines(text: string, forbidden: readonly ForbiddenCharacter[], file: string) {
	const findings: Finding[] = [];
	let line = 1;
	let offset = 0;
	for (const character of text) {
		const codePoint = character.codePointAt(0);
		if (codePoint === undefined) {
			offset += character.length;
			continue;
		}
		const entry = forbidden.find(
			({ codePoint: point, range }) => point === codePoint || (range !== undefined && codePoint >= range[0] && codePoint <= range[1]),
		);
		if (entry !== undefined) {
			const label = `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
			findings.push({
				file,
				fix: entry.replacement === undefined ? undefined : { end: offset + character.length, replacement: entry.replacement, start: offset },
				line,
				message: entry.message ?? `${label} is forbidden.`,
			});
		}
		if (character === "\n") {
			line += 1;
		}
		offset += character.length;
	}
	return findings;
}

function nonAsciiLines(bytes: Uint8Array): readonly number[] {
	const lines = new Set<number>();
	let line = 1;
	for (const byte of bytes) {
		if (byte > 127) {
			lines.add(line);
		}
		if (byte === 10) {
			line += 1;
		}
	}
	return [...lines];
}

export const asciiFindings = Effect.fn("Quality.asciiFindings")(function* ({ files, options, root }: RuleContext<AsciiOptions>) {
	const fs = yield* FileSystem.FileSystem;
	const patterns = options.files.map(globMatcher);
	const selected = files.filter((file) => patterns.some((matches) => matches(file)));
	const findings = yield* Effect.forEach(selected, (file) =>
		Effect.gen(function* () {
			const bytes = yield* fs.readFile(join(root, file));
			if (options.forbidden !== undefined) {
				return forbiddenLines(new TextDecoder("utf-8", { "ignoreBOM": true }).decode(bytes), options.forbidden, file);
			}
			return nonAsciiLines(bytes).map((line) => ({
				file,
				line,
				message: "This file is ASCII-only. Replace non-ASCII characters with ASCII text or escapes.",
			}));
		}),
	);
	return findings.flat();
});
