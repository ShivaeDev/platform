import { join, posix } from "node:path";
import ts from "typescript";
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

function found(root: string, directory: string, candidates: readonly string[]): DocumentedModule {
	const path = candidates.map((candidate) => posix.join(directory, candidate)).find((candidate) => ts.sys.fileExists(join(root, candidate)));
	return path === undefined ? MISSING : { kind: "source", path };
}

export function documentedModule(root: string, owner: WorkspacePackage, exports: unknown, specifier: string): DocumentedModule {
	const rest = specifier.slice(owner.name.length);
	const subpath = rest === "" ? "." : `.${rest}`;
	if (exports === undefined || exports === null) {
		return found(root, owner.directory, [subpath]);
	}
	const entry = exportEntry(typeof exports === "string" || Array.isArray(exports) ? { ".": exports } : exports, subpath);
	if (entry === undefined) {
		return MISSING;
	}
	const [prefix = "", suffix = ""] = entry[0].split("*");
	const star = subpath.slice(prefix.length, subpath.length - suffix.length);
	return found(
		root,
		owner.directory,
		exportTargets(entry[1]).flatMap((target) => sourcesFor(target.replace("*", star))),
	);
}
