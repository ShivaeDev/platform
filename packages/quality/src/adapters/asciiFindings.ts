import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { globMatcher } from "#imports/globMatcher.ts";
import type { RuleContext } from "#rule.ts";

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

export const asciiFindings = Effect.fn("Quality.asciiFindings")(function* ({
	files,
	options,
	root,
}: RuleContext<{ readonly files: readonly string[] }>) {
	const fs = yield* FileSystem.FileSystem;
	const patterns = options.files.map(globMatcher);
	const selected = files.filter((file) => patterns.some((matches) => matches(file)));
	const findings = yield* Effect.forEach(selected, (file) =>
		Effect.gen(function* () {
			const bytes = yield* fs.readFile(join(root, file));
			return nonAsciiLines(bytes).map((line) => ({
				file,
				line,
				message: "This file is ASCII-only. Replace non-ASCII characters with ASCII text or escapes.",
			}));
		}),
	);
	return findings.flat();
});
