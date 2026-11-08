import { Effect } from "effect";
import type { ImportAnalysisFailure } from "#adapters/ImportAnalysisFailure.ts";
import { readPackageManifest } from "#adapters/manifestInventory.ts";
import { importGraph } from "#imports/graph.ts";
import { isPackageRootConfig } from "#imports/isTooling.ts";
import { packageNameOf } from "#imports/packageName.ts";
import { packageOf } from "#imports/workspace.ts";
import { testName } from "#naming/testName.ts";
import type { Finding, RuleInputs } from "#rule.ts";
import { entryModules } from "#rules/effect/boundaryReference.ts";

const CLIENT_RENDERING_LIBRARIES = new Set([
	"react",
	"react-dom",
	"recharts",
	"lucide-react",
	"@base-ui/react",
	"@tanstack/react-router",
	"@tanstack/react-table",
	"class-variance-authority",
	"cn",
	"clsx",
	"tailwind-merge",
]);

// Path functions compute strings and touch no file system or process state, so they need no adapter.
const PURE_BUILTINS = new Set(["node:path", "node:path/posix", "node:path/win32"]);

function exempt(directory: string, path: string, name: string): boolean {
	return (
		/(?:^|\/)(?:adapters|test-support)\//u.test(path)
		|| PURE_BUILTINS.has(name)
		|| isPackageRootConfig(directory, path)
		|| (name === "vitest" && testName(path) !== undefined)
		|| name === "effect"
		|| name.startsWith("@effect/")
		|| name.startsWith("@shivaedev/")
		|| (CLIENT_RENDERING_LIBRARIES.has(name) && /(?:^|\/)client\//u.test(path))
	);
}

export const outsideImportFindings = Effect.fn("Imports.outsideImportFindings")(function* (
	inputs: RuleInputs,
): Effect.fn.Return<readonly Finding[], ImportAnalysisFailure> {
	const graph = yield* importGraph(inputs);
	const owners = [...graph.packages.map((owner) => owner.directory), "."];
	const runtime = new Map(
		yield* Effect.forEach(
			owners,
			(directory) =>
				Effect.gen(function* () {
					const manifest = yield* Effect.promise(() => readPackageManifest(inputs.readText, `${directory}/package.json`));
					return [
						directory,
						new Set(Object.keys({ ...manifest?.dependencies, ...manifest?.peerDependencies, ...manifest?.optionalDependencies })),
					] as const;
				}),
			{ concurrency: "unbounded" },
		),
	);
	const workspace = new Set(graph.packages.map((owner) => owner.name));
	const sites = [
		...graph.edges.flatMap((edge) => (edge.to.kind === "external" ? [{ ...edge, name: edge.to.package }] : [])),
		...graph.unresolved
			.filter((edge) => edge.missing === undefined && !/^[.#/]/u.test(edge.specifier))
			.map((edge) => ({ ...edge, name: packageNameOf(edge.specifier) })),
	];
	const outside = sites.filter((site) => {
		const directory = packageOf(graph.packages, site.from)?.directory ?? ".";
		return !(
			workspace.has(site.name)
			|| site.type
			|| site.kind !== "import"
			|| exempt(directory, site.from, site.name)
			|| !(site.name.startsWith("node:") || runtime.get(directory)?.has(site.name))
		);
	});
	const processImporters = new Set(outside.flatMap((site) => (site.name === "node:process" ? [site.from] : [])));
	const entries = entryModules(inputs.sources.filter((file) => processImporters.has(file.path)));
	return outside
		.filter((site) => !(site.name === "node:process" && entries.has(site.from)))
		.map((site) => ({
			file: site.from,
			line: site.line,
			message: `Imports outside library "${site.specifier}" as a value. Move the integration into an adapters/ module with explicit imports that exposes Effect values; use import type for types. Read environment variables with Config instead of process.env, including in adapters/.`,
		}));
});
