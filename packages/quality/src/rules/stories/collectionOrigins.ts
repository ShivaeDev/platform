import ts from "typescript";

export type Origin = "factory" | "kit" | "story" | "plain" | "suite" | "vitest" | "stories" | "function" | readonly Origin[] | undefined;

export function commonOrigin(values: readonly Origin[]): Origin {
	const first = values[0];
	if (values.length === 0 || values.every((value) => value === first)) {
		return first;
	}
	if (typeof first !== "object" || !values.every((value) => typeof value === "object" && value.length === first.length)) {
		return undefined;
	}
	return first.map((_, index) => commonOrigin(values.map((value) => (typeof value === "object" ? value[index] : undefined))));
}

export function iterationOrigin(node: ts.Node, origin: (node: ts.Node) => Origin): Origin {
	const loop = node.parent.parent;
	const values = ts.isForOfStatement(loop) ? origin(loop.expression) : undefined;
	return typeof values === "object" ? commonOrigin(values) : undefined;
}
