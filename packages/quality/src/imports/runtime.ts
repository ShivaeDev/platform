import { statSync } from "node:fs";
import { join, posix } from "node:path";
import { Effect } from "effect";
import { readPackageManifest } from "#adapters/manifestInventory.ts";
import type { RuleInputs } from "#rule.ts";
import { classifyRuntime } from "./classifyRuntime.ts";
import type { WorkspacePackage } from "./workspace.ts";

export type Runtime = "client" | "server" | "shared";

export type DeclaredRuntime = "client" | "server";

function executablePath(value: unknown): boolean {
	return typeof value === "string" && value.trim().length > 0;
}

function hasExecutable(manifest: object | undefined): boolean {
	const bin: unknown = manifest === undefined ? undefined : Reflect.get(manifest, "bin");
	return executablePath(bin) || (typeof bin === "object" && bin !== null && !Array.isArray(bin) && Object.values(bin).some(executablePath));
}

function declaredValue(manifest: object | undefined): unknown {
	const quality: unknown = manifest === undefined ? undefined : Reflect.get(manifest, "quality");
	return typeof quality === "object" && quality !== null ? Reflect.get(quality, "runtime") : undefined;
}

function declaredRuntime(manifest: object | undefined): DeclaredRuntime | undefined {
	const value = declaredValue(manifest);
	return value === "client" || value === "server" ? value : undefined;
}

function directoryExists(path: string): boolean {
	try {
		return statSync(path).isDirectory();
	} catch (cause) {
		if (cause instanceof Error && "code" in cause && (cause.code === "ENOENT" || cause.code === "ENOTDIR")) {
			return false;
		}
		throw cause;
	}
}

type Owner = Pick<WorkspacePackage, "directory">;

function runtimeFoldersOf(root: string, owner: Owner): readonly string[] {
	return ["client", "server"].filter((folder) => directoryExists(join(root, owner.directory, "src", folder)));
}

export interface RuntimeDeclarationProblem {
	readonly directory: string;
	readonly message: string;
}

function problemsFor(root: string, owner: Owner, manifest: object | undefined): readonly RuntimeDeclarationProblem[] {
	const value = declaredValue(manifest);
	if (value === undefined) {
		return [];
	}
	if (value !== "client" && value !== "server") {
		return [
			{
				directory: owner.directory,
				message: `"quality.runtime" is ${JSON.stringify(value)}. Declare "client" or "server" for a package whose code runs in one runtime, or remove the field and use src/client/ and src/server/.`,
			},
		];
	}
	const folders = runtimeFoldersOf(root, owner);
	return folders.length === 0
		? []
		: [
				{
					directory: owner.directory,
					message: `"quality.runtime" declares the whole package ${value} code, but it also has ${folders.map((folder) => `src/${folder}/`).join(" and ")}. Keep one convention: remove the declaration and classify code by runtime folders, or move the code out of the runtime folders.`,
				},
			];
}

export const runtimeDeclarationProblems = Effect.fn("Imports.runtimeDeclarationProblems")(function* (
	inputs: RuleInputs,
	packages: readonly WorkspacePackage[],
) {
	const problems = yield* Effect.forEach([...packages, { directory: ".", name: "." }], (owner) =>
		Effect.map(
			Effect.promise(() => readPackageManifest(inputs.readText, posix.join(owner.directory, "package.json"))),
			(manifest) => problemsFor(inputs.root, owner, manifest),
		),
	);
	return problems.flat();
});

export const runtimeOf = Effect.fn("Imports.runtimeOf")(function* (inputs: RuleInputs, packages: readonly WorkspacePackage[]) {
	const owners = [...packages, { directory: ".", name: "." }];
	const manifests = new Map(
		yield* Effect.forEach(owners, (owner) =>
			Effect.map(
				Effect.promise(() => readPackageManifest(inputs.readText, posix.join(owner.directory, "package.json"))),
				(manifest) => [owner.directory, manifest] as const,
			),
		),
	);
	const adopted = new Set(owners.filter((owner) => runtimeFoldersOf(inputs.root, owner).length > 0).map((owner) => owner.directory));
	const declared = new Map(
		owners.flatMap((owner) => {
			const runtime = declaredRuntime(manifests.get(owner.directory));
			return runtime === undefined || adopted.has(owner.directory) ? [] : [[owner.directory, runtime] as const];
		}),
	);
	const executable = new Set(owners.filter((owner) => hasExecutable(manifests.get(owner.directory))).map((owner) => owner.directory));
	const policy = { adopted, declared, executable, packages };
	return (path: string) => classifyRuntime(policy, path);
});
