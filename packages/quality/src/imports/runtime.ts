import { join, posix } from "node:path";
import { Effect, FileSystem } from "effect";
import { readPackageManifest } from "#adapters/manifestInventory.ts";
import { orWhenAbsent } from "#inventory/filesystem.ts";
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

type Owner = Pick<WorkspacePackage, "directory">;

const runtimeFoldersOf = Effect.fn("Imports.runtimeFoldersOf")(function* (root: string, owner: Owner) {
	const fs = yield* FileSystem.FileSystem;
	return yield* Effect.filter(["client", "server"], (folder) => {
		const path = join(root, owner.directory, "src", folder);
		return orWhenAbsent(
			path,
			Effect.map(fs.stat(path), (info) => info.type === "Directory"),
			false,
		);
	});
});

export interface RuntimeDeclarationProblem {
	readonly directory: string;
	readonly message: string;
}

const problemsFor = Effect.fn("Imports.problemsFor")(function* (root: string, owner: Owner, manifest: object | undefined) {
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
	const folders = yield* runtimeFoldersOf(root, owner);
	return folders.length === 0
		? []
		: [
				{
					directory: owner.directory,
					message: `"quality.runtime" declares the whole package ${value} code, but it also has ${folders.map((folder) => `src/${folder}/`).join(" and ")}. Keep one convention: remove the declaration and classify code by runtime folders, or move the code out of the runtime folders.`,
				},
			];
});

export const runtimeDeclarationProblems = Effect.fn("Imports.runtimeDeclarationProblems")(function* (
	inputs: RuleInputs,
	packages: readonly WorkspacePackage[],
) {
	const problems = yield* Effect.forEach([...packages, { directory: ".", name: "." }], (owner) =>
		Effect.flatMap(
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
	const folders = yield* Effect.filter(owners, (owner) => Effect.map(runtimeFoldersOf(inputs.root, owner), (found) => found.length > 0));
	const adopted = new Set(folders.map((owner) => owner.directory));
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
