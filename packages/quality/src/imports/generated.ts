import { execFile } from "node:child_process";
import { posix } from "node:path";
import { promisify } from "node:util";
import { emptyScope, type IgnoreScope, verdictFor, withIgnoreFile } from "#inventory/ignore-scope.ts";
import type { RuleInputs } from "#rule.ts";
import type { ImportGraph, UnresolvedImport } from "./graph.ts";

type Reader = Pick<RuleInputs, "readText" | "root">;

const IGNORE_FILE = ".gitignore";

const LEADING_DOT = /^\.\//u;

const TRAILING_SLASHES = /\/+$/u;

const NODE_MODULES = "node_modules";

const NOT_A_REPOSITORY = "not a git repository";

const PLACEHOLDERS = new Set([".gitkeep", ".keep"]);

const run = promisify(execFile);

async function withIgnoreFileIn(reader: Reader, scope: IgnoreScope, directory: string): Promise<IgnoreScope> {
	const contents = await reader.readText(posix.join(directory, IGNORE_FILE));
	return contents === undefined || contents === "" ? scope : withIgnoreFile(scope, posix.join(reader.root, directory), contents);
}

async function ignored(reader: Reader, file: string): Promise<boolean> {
	const parts = file.split("/");
	let scope = emptyScope;
	for (const index of parts.keys()) {
		scope = await withIgnoreFileIn(reader, scope, parts.slice(0, index).join("/") || ".");
		if (verdictFor(scope, posix.join(reader.root, ...parts.slice(0, index + 1)), index < parts.length - 1) === "ignored") {
			return true;
		}
	}
	return false;
}

async function tracked(root: string, folder: string): Promise<readonly string[]> {
	try {
		const { stdout } = await run("git", ["ls-files", "-z", "--", folder], { cwd: root });
		return stdout.split("\0").filter(Boolean);
	} catch (error) {
		if (error instanceof Error && "stderr" in error && String(error.stderr).includes(NOT_A_REPOSITORY)) {
			return [];
		}
		throw error;
	}
}

function under(folder: string, path: string | undefined): boolean {
	return path?.startsWith(`${folder}/`) === true;
}

async function contentIssue(reader: Reader, folder: string, named: readonly string[]): Promise<string | undefined> {
	const verdicts = await Promise.all(named.map((file) => ignored(reader, file)));
	if (verdicts.includes(false)) {
		return `"${folder}" is not ignored by git, so it holds source, not generated output`;
	}
	const kept = (await tracked(reader.root, folder)).find((file) => !PLACEHOLDERS.has(posix.basename(file)));
	return kept === undefined ? undefined : `"${folder}" holds files git tracks, such as ${kept}, so it is not generated output`;
}

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

async function issueOf(reader: Reader, graph: ImportGraph, folder: string): Promise<string | undefined> {
	const misplaced = placeIssue(graph, folder);
	if (misplaced !== undefined) {
		return misplaced;
	}
	const named = [...new Set(graph.edges.flatMap((edge) => (edge.to.kind === "file" && under(folder, edge.to.path) ? [edge.to.path] : [])))];
	return await contentIssue(reader, folder, named);
}

// A generated folder may be empty until its generator runs, so a relative import of a missing file in it resolves.
export async function withoutGenerated(reader: Reader, graph: ImportGraph, declared: readonly string[]): Promise<readonly UnresolvedImport[]> {
	const folders = declared.map((folder) => posix.normalize(folder).replace(LEADING_DOT, "").replace(TRAILING_SLASHES, ""));
	const issues = (await Promise.all(folders.map((folder) => issueOf(reader, graph, folder)))).flatMap((issue) => issue ?? []);
	if (issues.length > 0) {
		throw new Error(`the generated folders are invalid:\n${issues.map((issue) => `  - ${issue}`).join("\n")}`);
	}
	return graph.unresolved.filter((request) => !folders.some((folder) => under(folder, request.missing)));
}
