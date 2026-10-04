import { posix } from "node:path";
import type { RuleInputs } from "../../rule.ts";
import { packageOf, type WorkspacePackage } from "../workspace.ts";
import type { AliasScope } from "./choose.ts";
import { emittedModules } from "./emitted.ts";
import { exportMappings, importMappings } from "./pattern.ts";

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

export type AliasScopes = (file: string, target: string) => Promise<AliasScope>;

export function aliasScopes(reader: Pick<RuleInputs, "readText">, root: string, packages: readonly WorkspacePackage[]): AliasScopes {
	const manifests = new Map<string, Promise<unknown>>();
	const emitted = emittedModules();
	function manifestAt(directory: string): Promise<unknown> {
		const known = manifests.get(directory) ?? reader.readText(posix.join(directory, MANIFEST)).then(parsed);
		manifests.set(directory, known);
		return known;
	}
	async function nearest(file: string): Promise<{ readonly directory: string; readonly manifest: unknown } | undefined> {
		for (let directory = posix.dirname(file); ; directory = posix.dirname(directory)) {
			const manifest = await manifestAt(directory);
			if (manifest !== undefined) {
				return { directory: posix.join(root, directory), manifest };
			}
			if (directory === TOP) {
				return undefined;
			}
		}
	}
	return async (file, target) => {
		const own = await nearest(file);
		const ownerPackage = packageOf(packages, target);
		const owner =
			ownerPackage === undefined
				? undefined
				: { directory: posix.join(root, ownerPackage.directory), manifest: await manifestAt(ownerPackage.directory) };
		return {
			crossing: ownerPackage !== undefined && ownerPackage !== packageOf(packages, file),
			emitted,
			exported: owner === undefined ? [] : exportMappings(owner.manifest, owner.directory),
			imports: own === undefined ? [] : importMappings(own.manifest, own.directory),
			own,
			owner,
		};
	};
}
