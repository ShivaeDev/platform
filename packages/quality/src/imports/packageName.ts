import { isBuiltin } from "node:module";

const NODE_PREFIX = "node:";

const TYPES_SCOPE = "@types";

const TYPES_SCOPE_SEPARATOR = "__";

export function builtinName(specifier: string): string | undefined {
	if (!isBuiltin(specifier)) {
		return undefined;
	}
	return specifier.startsWith(NODE_PREFIX) ? specifier : `${NODE_PREFIX}${specifier}`;
}

function typedName(name: string): string {
	return name.includes(TYPES_SCOPE_SEPARATOR) ? `@${name.replace(TYPES_SCOPE_SEPARATOR, "/")}` : name;
}

export function nameAt(path: string): string {
	const [first = "", second] = path.split("/");
	if (second === undefined || !first.startsWith("@")) {
		return first;
	}
	return first === TYPES_SCOPE ? typedName(second) : `${first}/${second}`;
}

// The example checker and the graph name a package through this one function, so a fence example and a real import cannot disagree.
export function packageNameOf(specifier: string): string {
	return builtinName(specifier) ?? nameAt(specifier);
}
