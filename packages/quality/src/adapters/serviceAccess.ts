import { basename } from "node:path";
import ts from "typescript";
import type { BodyReference } from "#adapters/bodyReference.ts";

function nativeService({ module, path }: BodyReference): boolean {
	const name = path[0];
	return name !== undefined && (module === "effect" || module.startsWith("effect/")) && (basename(module) === name || path[1] === name);
}

function member(value: BodyReference): boolean {
	return value.kind === "service" ? value.path.length > 0 : nativeService(value) && value.path.length > (value.path[0] === value.path[1] ? 2 : 1);
}

function outerExpression(node: ts.Node): ts.Node {
	let use = node;
	while (ts.isParenthesizedExpression(use.parent) || ts.isAsExpression(use.parent) || ts.isNonNullExpression(use.parent)) {
		use = use.parent;
	}
	return use;
}

function readsService(called: BodyReference | undefined): boolean {
	return called !== undefined && !called.path.at(-1)?.startsWith("provide") && ["effect", "effect/Effect", "effect/Context"].includes(called.module);
}

export function serviceAccess(node: ts.Node, value: BodyReference, reference: (node: ts.Node) => BodyReference | undefined): boolean {
	if (!(value.kind === "service" || (value.kind === "import" && nativeService(value)))) {
		return false;
	}
	if (value.kind === "service" && value.path.at(-1) === "of") {
		return false;
	}
	if (member(value)) {
		return true;
	}
	const use = outerExpression(node);
	return ts.isYieldExpression(use.parent) || (ts.isCallExpression(use.parent) && readsService(reference(use.parent.expression)));
}
