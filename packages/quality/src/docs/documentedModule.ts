import { join, posix } from "node:path";
import ts from "typescript";
import { inGeneratedFolder } from "#imports/generatedFolders.ts";
import { exportEntry, exportTargets } from "#imports/packageExports.ts";
import type { WorkspacePackage } from "#imports/workspace.ts";

export type DocumentedModule = { readonly kind: "missing" } | { readonly kind: "source"; readonly path: string };

const BUILT = /^\.\/dist\/(?<path>.+?)(?:\.d)?\.[cm]?[jt]s$/u;

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"];

const MISSING: DocumentedModule = { kind: "missing" };

function sourcesFor(target: string): readonly string[] {
	const built = BUILT.exec(target)?.groups?.path;
	return built === undefined ? [target] : [target, ...SOURCE_EXTENSIONS.map((extension) => `./src/${built}${extension}`)];
}

// A generator may not have written a file in a declared generated folder yet, so a path into one names a module without it on disk.
function found(root: string, generated: readonly string[], directory: string, candidates: readonly string[]): DocumentedModule {
	const paths = candidates.map((candidate) => posix.join(directory, candidate));
	const path =
		paths.find((candidate) => ts.sys.fileExists(join(root, candidate))) ?? paths.find((candidate) => inGeneratedFolder(generated, candidate));
	return path === undefined ? MISSING : { kind: "source", path };
}

export function documentedModule(
	root: string,
	generated: readonly string[],
	owner: WorkspacePackage,
	exports: unknown,
	specifier: string,
): DocumentedModule {
	const rest = specifier.slice(owner.name.length);
	const subpath = rest === "" ? "." : `.${rest}`;
	if (exports === undefined || exports === null) {
		return found(root, generated, owner.directory, [subpath]);
	}
	const entry = exportEntry(typeof exports === "string" || Array.isArray(exports) ? { ".": exports } : exports, subpath);
	if (entry === undefined) {
		return MISSING;
	}
	const [prefix = "", suffix = ""] = entry[0].split("*");
	const star = subpath.slice(prefix.length, subpath.length - suffix.length);
	return found(
		root,
		generated,
		owner.directory,
		exportTargets(entry[1]).flatMap((target) => sourcesFor(target.replace("*", star))),
	);
}
