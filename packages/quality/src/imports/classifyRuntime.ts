import { posix } from "node:path";
import { isTooling } from "./isTooling.ts";
import type { DeclaredRuntime, Runtime } from "./runtime.ts";
import { packageOf, type WorkspacePackage } from "./workspace.ts";

export interface RuntimePolicy {
	readonly adopted: ReadonlySet<string>;
	readonly declared: ReadonlyMap<string, DeclaredRuntime>;
	readonly executable: ReadonlySet<string>;
	readonly packages: readonly WorkspacePackage[];
}

export function classifyRuntime(policy: RuntimePolicy, path: string): Runtime | undefined {
	const owner = packageOf(policy.packages, path)?.directory ?? ".";
	if (isTooling(owner, path)) {
		return "server";
	}
	const whole = policy.declared.get(owner);
	if (whole !== undefined) {
		return whole;
	}
	if (!policy.adopted.has(owner)) {
		return policy.executable.has(owner) ? "server" : undefined;
	}
	const local = posix.relative(owner, path).replace(/^src\/modules\/[^/]+\//u, "src/");
	if (local.startsWith("src/client/")) {
		return "client";
	}
	return local.startsWith("src/server/") ? "server" : "shared";
}
