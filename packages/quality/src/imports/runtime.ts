import { readFileSync, statSync } from "node:fs";
import { join, posix } from "node:path";
import type { RuleInputs } from "#rule.ts";
import { isTooling } from "./isTooling.ts";
import { packageOf, type WorkspacePackage } from "./workspace.ts";

export type Runtime = "client" | "server" | "shared";

function executablePath(value: unknown): boolean {
	return typeof value === "string" && value.trim().length > 0;
}

function hasExecutable(root: string, directory: string): boolean {
	const path = join(root, directory, "package.json");
	try {
		const manifest: unknown = JSON.parse(readFileSync(path, "utf8"));
		if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
			throw new Error("the manifest must be an object");
		}
		const bin: unknown = Reflect.get(manifest, "bin");
		return executablePath(bin) || (typeof bin === "object" && bin !== null && !Array.isArray(bin) && Object.values(bin).some(executablePath));
	} catch (cause) {
		if (cause instanceof Error && "code" in cause && cause.code === "ENOENT") {
			return false;
		}
		throw new Error(`cannot read runtime policy at ${path}`, { cause });
	}
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

export function runtimeOf(inputs: RuleInputs, packages: readonly WorkspacePackage[]): (path: string) => Runtime | undefined {
	const owners = [...packages, { directory: ".", name: "." }];
	const adopted = new Set(
		owners
			.filter((owner) => ["client", "server"].some((folder) => directoryExists(join(inputs.root, owner.directory, "src", folder))))
			.map((owner) => owner.directory),
	);
	const executable = new Set(owners.filter((owner) => hasExecutable(inputs.root, owner.directory)).map((owner) => owner.directory));
	return (path) => {
		const owner = packageOf(packages, path)?.directory ?? ".";
		if (isTooling(owner, path)) {
			return "server";
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
