import { Effect } from "effect";
import type { ImportAnalysisFailure } from "#adapters/ImportAnalysisFailure.ts";
import type { GlobFailure } from "#imports/globMatcher.ts";
import { importGraph } from "#imports/graph.ts";
import { isPackageRootConfig } from "#imports/isTooling.ts";
import type { PnpmWorkspaceFailure } from "#imports/pnpmWorkspacePatterns.ts";
import { packageOf } from "#imports/workspace.ts";
import type { Finding, RuleInputs } from "#rule.ts";
import { entryModules } from "#rules/effect/boundaryReference.ts";

// Path functions compute strings and touch no file system or process state, so they need no adapter.
const PURE_BUILTINS = new Set(["node:path", "node:path/posix", "node:path/win32"]);

export const outsideImportFindings = Effect.fn("Imports.outsideImportFindings")(function* (
	inputs: RuleInputs,
): Effect.fn.Return<readonly Finding[], GlobFailure | ImportAnalysisFailure | PnpmWorkspaceFailure> {
	const graph = yield* importGraph(inputs);
	const builtins = graph.edges.flatMap((edge) =>
		edge.to.kind === "external"
		&& edge.to.package.startsWith("node:")
		&& !PURE_BUILTINS.has(edge.to.package)
		&& edge.kind === "import"
		&& !edge.type
		&& !/(?:^|\/)(?:adapters|test-support)\//u.test(edge.from)
		&& !isPackageRootConfig(packageOf(graph.packages, edge.from)?.directory ?? ".", edge.from)
			? [{ ...edge, name: edge.to.package }]
			: [],
	);
	const processImporters = new Set(builtins.flatMap((site) => (site.name === "node:process" ? [site.from] : [])));
	const entries = entryModules(inputs.sources.filter((file) => processImporters.has(file.path)));
	return builtins
		.filter((site) => !(site.name === "node:process" && entries.has(site.from)))
		.map((site) => ({
			file: site.from,
			line: site.line,
			message: `Imports Node builtin "${site.specifier}" as a value. Use Effect's FileSystem, ChildProcessSpawner, Config and other platform services, or bridge it in an adapters/ module with explicit imports that exposes Effect values; use import type for types. Read environment variables with Config instead of process.env, including in adapters/.`,
		}));
});
