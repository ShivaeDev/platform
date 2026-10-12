import { statSync } from "node:fs";
import { join, posix } from "node:path";
import type { RuleInputs } from "#rule.ts";
import { packageOf, type WorkspacePackage } from "./workspace.ts";

export type Runtime = "client" | "server" | "shared";

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
	return (path) => {
		const owner = packageOf(packages, path)?.directory ?? ".";
		if (!adopted.has(owner)) {
			return undefined;
		}
		const local = posix.relative(owner, path);
		if (local.startsWith("src/client/")) {
			return "client";
		}
		return local.startsWith("src/server/") ? "server" : "shared";
	};
}
