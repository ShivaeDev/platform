import { createHash } from "node:crypto";
import { posix, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { WorkspacePackage } from "#imports/workspace.ts";
import type { RuleInputs } from "#rule.ts";
import { decodeDeclarations } from "./declarations.ts";
import type { Fence } from "./model.ts";

export const BOUNDARY_FILE = "quality.fences.config.ts";

async function loadBoundary(inputs: RuleInputs, directory: string): Promise<readonly Fence[]> {
	const file = posix.join(directory, BOUNDARY_FILE);
	try {
		const text = await inputs.readText(file);
		if (text === undefined) {
			return [];
		}
		const url = pathToFileURL(resolve(inputs.root, file));
		url.searchParams.set("content", createHash("sha256").update(text).digest("hex"));
		const loaded: unknown = await import(url.href);
		if (typeof loaded !== "object" || loaded === null || !("default" in loaded)) {
			throw new Error("export an array of fence() declarations as the default export");
		}
		const decoded = await decodeDeclarations(loaded.default);
		if (decoded._tag === "Invalid") {
			throw new Error(`export an array of fence() declarations:\n${decoded.issues.join("\n")}`);
		}
		return decoded.value;
	} catch (cause) {
		throw new Error(`cannot load boundary at ${file}: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
	}
}

export async function discoverFences(inputs: RuleInputs, packages: readonly WorkspacePackage[]): Promise<readonly Fence[]> {
	const boundaries = await Promise.all([".", ...packages.map((owner) => owner.directory)].map((directory) => loadBoundary(inputs, directory)));
	return boundaries.flat();
}
