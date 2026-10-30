import { basename, posix, relative } from "node:path";
import { Effect } from "effect";
import { SetupFailure } from "#failure.ts";
import { emptyScope, type IgnoreScope, verdictFor, withIgnoreFile } from "#inventory/ignoreScope.ts";
import { trackedPaths } from "#inventory/trackedPaths.ts";
import type { RuleInputs } from "#rule.ts";
import type { ImportGraph } from "./graph.ts";

type Reader = Pick<RuleInputs, "readText" | "root">;

const IGNORE_FILE = ".gitignore";

const LEADING_DOT = /^\.\//u;

const TRAILING_SLASHES = /\/+$/u;

const NODE_MODULES = "node_modules";

const PLACEHOLDERS = new Set([".gitkeep", ".keep"]);

const withIgnoreFileIn = Effect.fn("Imports.withIgnoreFileIn")(function* (reader: Reader, scope: IgnoreScope, directory: string) {
	const contents = yield* Effect.promise(() => reader.readText(posix.join(directory, IGNORE_FILE)));
	return contents === undefined || contents === "" ? scope : withIgnoreFile(scope, posix.join(reader.root, directory), contents);
});

const ignored = Effect.fn("Imports.ignored")(function* (reader: Reader, file: string) {
	const parts = file.split("/");
	let scope = emptyScope;
	for (const index of parts.keys()) {
		scope = yield* withIgnoreFileIn(reader, scope, parts.slice(0, index).join("/") || ".");
		if (verdictFor(scope, posix.join(reader.root, ...parts.slice(0, index + 1)), index < parts.length - 1) === "ignored") {
			return true;
		}
	}
	return false;
});

function under(folder: string, path: string | undefined): boolean {
	return path?.startsWith(`${folder}/`) === true;
}

const contentIssue = Effect.fn("Imports.contentIssue")(function* (reader: Reader, folder: string, named: readonly string[]) {
	const verdicts = yield* Effect.forEach(named, (file) => ignored(reader, file), { concurrency: "unbounded" });
	if (verdicts.includes(false)) {
		return `"${folder}" is not ignored by git, so it holds source, not generated output`;
	}
	const kept = (yield* trackedPaths(reader.root, folder)).find((file) => !PLACEHOLDERS.has(basename(file)));
	return kept === undefined ? undefined : `"${folder}" holds files git tracks, such as ${relative(reader.root, kept)}, so it is not generated output`;
});

function placeIssue(graph: ImportGraph, folder: string): string | undefined {
	if (folder === "" || folder.startsWith("../") || posix.isAbsolute(folder)) {
		return `"${folder}" is no folder inside the repository`;
	}
	if (folder.split("/").includes(NODE_MODULES)) {
		return `"${folder}" lies in node_modules, which holds installed packages, not generated output`;
	}
	return graph.edges.some((edge) => edge.to.kind === "file" && under(folder, edge.to.path))
		? undefined
		: `"${folder}" holds no file that an import names`;
}

const issueOf = Effect.fn("Imports.issueOf")(function* (reader: Reader, graph: ImportGraph, folder: string) {
	const misplaced = placeIssue(graph, folder);
	if (misplaced !== undefined) {
		return misplaced;
	}
	const named = [...new Set(graph.edges.flatMap((edge) => (edge.to.kind === "file" && under(folder, edge.to.path) ? [edge.to.path] : [])))];
	return yield* contentIssue(reader, folder, named);
});

// A generated folder may be empty until its generator runs, so a relative import of a missing file in it resolves.
export const withoutGenerated = Effect.fn("Imports.withoutGenerated")(function* (reader: Reader, graph: ImportGraph, declared: readonly string[]) {
	const folders = declared.map((folder) => posix.normalize(folder).replace(LEADING_DOT, "").replace(TRAILING_SLASHES, ""));
	const issues = (yield* Effect.forEach(folders, (folder) => issueOf(reader, graph, folder), { concurrency: "unbounded" })).flatMap(
		(issue) => issue ?? [],
	);
	if (issues.length > 0) {
		return yield* new SetupFailure({ message: `the generated folders are invalid:\n${issues.map((issue) => `  - ${issue}`).join("\n")}` });
	}
	return graph.unresolved.filter((request) => !folders.some((folder) => under(folder, request.missing)));
});
