import type ts from "typescript";
import { type Trail, walkFrom } from "#imports/fences/reach.ts";
import type { ImportEdge } from "#imports/graph.ts";
import type { Finding } from "#rule.ts";
import { runtimeOrigins } from "./runtimeOrigins.ts";
import { firstRuntimeUse, type RuntimeUse } from "./runtimeUse.ts";

export const PURE_REPAIR = "Exercise the Effect behaviour through the package story kit, or test an existing pure API without the runner.";

export function runtime(checker: ts.TypeChecker, source: (path: string) => ts.SourceFile | undefined) {
	const origin = runtimeOrigins(checker);
	const known = new Map<string, RuntimeUse | undefined>();

	function runtimeUse(module: string): RuntimeUse | undefined {
		if (known.has(module)) {
			return known.get(module);
		}
		const syntax = source(module);
		const first = syntax === undefined ? undefined : firstRuntimeUse(syntax, origin);
		known.set(module, first);
		return first;
	}

	function findings(file: string, visited: ReadonlyMap<string, Trail>): readonly Finding[] {
		const found: Finding[] = [];
		for (const [module, trail] of visited) {
			const use = runtimeUse(module);
			if (use === undefined) {
				continue;
			}
			const chain = [...trail.path.slice(1, -1), `${module}:${use.line}`].join(" -> ");
			found.push({
				file,
				line: module === file ? use.line : trail.line,
				message: `This \`.unit\` test reaches \`${use.what}\` through \`${chain}\`. ${PURE_REPAIR}`,
			});
		}
		return found;
	}

	return (file: string, edgesFrom: ReadonlyMap<string, readonly ImportEdge[]>): Finding | undefined => {
		const own = findings(file, new Map([[file, { line: 0, path: [file] }]]));
		const imported = (edgesFrom.get(file) ?? []).flatMap((edge) => {
			if (edge.to.kind !== "file") {
				return [];
			}
			const visited = walkFrom(edge.to.path, edgesFrom, () => undefined).visited;
			const trails = new Map([...visited].map(([module, trail]) => [module, { line: edge.line, path: [file, ...trail.path] }]));
			return findings(file, trails);
		});
		return [...own, ...imported].sort((a, b) => (a.line ?? 0) - (b.line ?? 0))[0];
	};
}
