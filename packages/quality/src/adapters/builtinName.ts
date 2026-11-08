import { isBuiltin } from "node:module";

const NODE_PREFIX = "node:";

export function builtinName(specifier: string): string | undefined {
	if (!isBuiltin(specifier)) {
		return undefined;
	}
	return specifier.startsWith(NODE_PREFIX) ? specifier : `${NODE_PREFIX}${specifier}`;
}
