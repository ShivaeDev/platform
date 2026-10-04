import { posix } from "node:path";
import type ts from "typescript";
import type { RuleInputs } from "../../rule.ts";
import { packageOf, type WorkspacePackage } from "../workspace.ts";
import type { AliasScope } from "./choose.ts";
import { exportMappings, importMappings, pathMappings } from "./pattern.ts";

const MANIFEST = "package.json";

const TOP = ".";

function parsed(text: string | undefined): unknown {
	if (text === undefined) {
		return undefined;
	}
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}

// TypeScript records the folder of the tsconfig that declares `paths` without a `baseUrl` under an internal option.
function pathsBase(options: ts.CompilerOptions): string | undefined {
	const declared: unknown = options.baseUrl ?? Reflect.get(options, "pathsBasePath");
	return typeof declared === "string" ? declared : undefined;
}

export type AliasScopes = (file: string, target: string, options: ts.CompilerOptions) => Promise<AliasScope>;

export function aliasScopes(reader: Pick<RuleInputs, "readText">, root: string, packages: readonly WorkspacePackage[]): AliasScopes {
	const manifests = new Map<string, Promise<unknown>>();
	function manifestAt(directory: string): Promise<unknown> {
		const known = manifests.get(directory) ?? reader.readText(posix.join(directory, MANIFEST)).then(parsed);
		manifests.set(directory, known);
		return known;
	}
	async function nearest(file: string): Promise<{ readonly directory: string; readonly manifest: unknown } | undefined> {
		for (let directory = posix.dirname(file); ; directory = posix.dirname(directory)) {
			const manifest = await manifestAt(directory);
			if (manifest !== undefined) {
				return { directory, manifest };
			}
			if (directory === TOP) {
				return undefined;
			}
		}
	}
	return async (file, target, options) => {
		const own = await nearest(file);
		const owner = packageOf(packages, target);
		const base = pathsBase(options);
		return {
			crossing: owner !== undefined && owner !== packageOf(packages, file),
			exported: owner === undefined ? [] : exportMappings(await manifestAt(owner.directory), posix.join(root, owner.directory)),
			imports: own === undefined ? [] : importMappings(own.manifest, posix.join(root, own.directory)),
			paths: base === undefined ? [] : pathMappings(options.paths, base),
		};
	};
}
