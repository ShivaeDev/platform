import { readFileSync, statSync } from "node:fs";
import { join, posix } from "node:path";
import type { RuleInputs } from "#rule.ts";
import { isTooling } from "./isTooling.ts";
import { packageOf, type WorkspacePackage } from "./workspace.ts";

export type Runtime = "client" | "server" | "shared";

export type DeclaredRuntime = "client" | "server";

function executablePath(value: unknown): boolean {
	return typeof value === "string" && value.trim().length > 0;
}

function readManifest(root: string, directory: string): object | undefined {
	const path = join(root, directory, "package.json");
	try {
		const manifest: unknown = JSON.parse(readFileSync(path, "utf8"));
		if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
			throw new Error("the manifest must be an object");
		}
		return manifest;
	} catch (cause) {
		if (cause instanceof Error && "code" in cause && cause.code === "ENOENT") {
			return undefined;
		}
		throw new Error(`cannot read runtime policy at ${path}`, { cause });
	}
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

export function runtimeDeclarationProblems(inputs: RuleInputs, packages: readonly WorkspacePackage[]): readonly RuntimeDeclarationProblem[] {
	return [...packages, { directory: ".", name: "." }].flatMap((owner) => {
		const value = declaredValue(readManifest(inputs.root, owner.directory));
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
		const folders = runtimeFoldersOf(inputs.root, owner);
		return folders.length === 0
			? []
			: [
					{
						directory: owner.directory,
						message: `"quality.runtime" declares the whole package ${value} code, but it also has ${folders.map((folder) => `src/${folder}/`).join(" and ")}. Keep one convention: remove the declaration and classify code by runtime folders, or move the code out of the runtime folders.`,
					},
				];
	});
}

export function runtimeOf(inputs: RuleInputs, packages: readonly WorkspacePackage[]): (path: string) => Runtime | undefined {
	const owners = [...packages, { directory: ".", name: "." }];
	const manifests = new Map(owners.map((owner) => [owner.directory, readManifest(inputs.root, owner.directory)]));
	const adopted = new Set(owners.filter((owner) => runtimeFoldersOf(inputs.root, owner).length > 0).map((owner) => owner.directory));
	const declared = new Map(
		owners.flatMap((owner) => {
			const runtime = declaredRuntime(manifests.get(owner.directory));
			return runtime === undefined || adopted.has(owner.directory) ? [] : [[owner.directory, runtime] as const];
		}),
	);
	const executable = new Set(owners.filter((owner) => hasExecutable(manifests.get(owner.directory))).map((owner) => owner.directory));
	return (path) => {
		const owner = packageOf(packages, path)?.directory ?? ".";
		if (isTooling(owner, path)) {
			return "server";
		}
		const whole = declared.get(owner);
		if (whole !== undefined) {
			return whole;
		}
		if (!adopted.has(owner)) {
			return executable.has(owner) ? "server" : undefined;
		}
		const local = posix.relative(owner, path).replace(/^src\/modules\/[^/]+\//u, "src/");
		if (local.startsWith("src/client/")) {
			return "client";
		}
		return local.startsWith("src/server/") ? "server" : "shared";
	};
}
