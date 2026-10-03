import { posix } from "node:path";
import { emptyScope, type IgnoreScope, verdictFor, withIgnoreFile } from "../inventory/ignore-scope.ts";
import type { RuleInputs } from "../rule.ts";

type Reader = Pick<RuleInputs, "readText" | "root">;

const IGNORE_FILE = ".gitignore";

const QUERY = /\?.*$/u;

async function withIgnoreFileIn(reader: Reader, scope: IgnoreScope, directory: string): Promise<IgnoreScope> {
	const contents = await reader.readText(posix.join(directory, IGNORE_FILE));
	return contents === undefined || contents === "" ? scope : withIgnoreFile(scope, posix.join(reader.root, directory), contents);
}

async function ignored(reader: Reader, path: string): Promise<boolean> {
	const parts = path.split("/");
	let scope = emptyScope;
	for (const index of parts.keys()) {
		scope = await withIgnoreFileIn(reader, scope, parts.slice(0, index).join("/") || ".");
		if (verdictFor(scope, posix.join(reader.root, ...parts.slice(0, index + 1)), index < parts.length - 1) === "ignored") {
			return true;
		}
	}
	return false;
}

// A relative import of a path that git ignores names generated output, which resolves once its generator has run.
export async function generatedTarget(reader: Reader, from: string, specifier: string): Promise<string | undefined> {
	if (!(specifier.startsWith("./") || specifier.startsWith("../"))) {
		return undefined;
	}
	const target = posix.join(posix.dirname(from), specifier.replace(QUERY, ""));
	return !target.startsWith("../") && (await ignored(reader, target)) ? target : undefined;
}
