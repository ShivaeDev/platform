import { join, posix } from "node:path";
import { Effect, FileSystem } from "effect";
import { isDocument } from "#docs/isDocument.ts";
import { codeSpans, markdownLines } from "#docs/markdownLines.ts";
import type { Finding, RuleInputs } from "#rule.ts";

function pathIn(span: string): string | undefined {
	if (
		!(span.includes("/") && (span.startsWith(".") || span.endsWith("/") || /\.[a-z0-9]+(?::\d+(?::\d+)?|#.*)?$/iu.test(span)))
		|| /[\s*?<>${}\\]/u.test(span)
		|| /^(?:\/|@|~|[\w+.-]+:)/u.test(span)
		|| /(?:^|\/)node_modules(?:\/|$)/u.test(span)
	) {
		return;
	}
	return span.replace(/(?::\d+(?::\d+)?|#.*)$/u, "").replace(/\/+$/u, "");
}

function references(text: string) {
	return markdownLines(text)
		.filter((line) => line.kind === "prose")
		.flatMap((line) =>
			codeSpans(line.text).flatMap((span) => {
				const path = pathIn(span);
				return path === undefined ? [] : [{ line: line.number, path, span }];
			}),
		);
}

const missingPath = Effect.fn("Docs.missingPath")(function* (root: string, file: string, path: string) {
	const fs = yield* FileSystem.FileSystem;
	const explicit = path.startsWith("./") || path.startsWith("../");
	const local = posix.join(posix.dirname(file), path);
	const target = explicit ? local : posix.normalize(path);
	if (target === ".." || target.startsWith("../")) {
		return true;
	}
	if (yield* fs.exists(join(root, target))) {
		return false;
	}
	if (path.startsWith("./") && (yield* fs.exists(join(root, path)))) {
		return false;
	}
	return explicit || !(yield* fs.exists(join(root, local)));
});

export const repositoryPathFindings = Effect.fn("Docs.repositoryPathFindings")(function* ({ files, readText, root }: RuleInputs) {
	const roots = new Set(files.map((file) => file.split("/")[0]));
	const findings: Finding[] = [];
	for (const file of files.filter((path) => isDocument(path) && posix.basename(path) !== "CLAUDE.md")) {
		const text = yield* readText(file);
		for (const reference of references(text ?? "")) {
			const { path, span, line } = reference;
			if (!(path.startsWith("./") || path.startsWith("../") || roots.has(path.split("/")[0]))) {
				continue;
			}
			if (yield* missingPath(root, file, path)) {
				findings.push({
					file,
					line,
					message: `Repository path "${span}" does not resolve to an existing path inside the repository. Use its current path, relative to this document (./ or ../) or the repository root.`,
					subject: span,
				});
			}
		}
	}
	return findings;
});
