import { posix } from "node:path";
import type { RuleInputs } from "../rule.ts";

export interface WorkspacePackage {
	readonly directory: string;
	readonly name: string;
}

const MANIFEST = "package.json";

function nameIn(text: string | undefined): string | undefined {
	if (text === undefined) {
		return undefined;
	}
	try {
		const manifest: unknown = JSON.parse(text);
		return typeof manifest === "object" && manifest !== null && "name" in manifest && typeof manifest.name === "string" ? manifest.name : undefined;
	} catch {
		return undefined;
	}
}

export async function workspacePackages(inputs: Pick<RuleInputs, "files" | "readText">): Promise<readonly WorkspacePackage[]> {
	const manifests = inputs.files.filter((file) => posix.basename(file) === MANIFEST && file !== MANIFEST);
	const named = await Promise.all(
		manifests.map(async (manifest) => ({ directory: posix.dirname(manifest), name: nameIn(await inputs.readText(manifest)) })),
	);
	return named.flatMap(({ directory, name }) => (name === undefined ? [] : [{ directory, name }]));
}

export function packageOf(packages: readonly WorkspacePackage[], path: string): WorkspacePackage | undefined {
	const owners = packages.filter((candidate) => path.startsWith(`${candidate.directory}/`));
	return owners.toSorted((left, right) => right.directory.length - left.directory.length)[0];
}
