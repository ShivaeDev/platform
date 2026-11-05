import { Effect } from "effect";
import type { ImportAnalysisFailure } from "#adapters/ImportAnalysisFailure.ts";
import { readPackageManifest } from "#adapters/manifestInventory.ts";
import { importGraph } from "#imports/graph.ts";
import { packageNameOf } from "#imports/packageName.ts";
import { packageOf } from "#imports/workspace.ts";
import { testName } from "#naming/testName.ts";
import type { Finding, RuleInputs } from "#rule.ts";

const CLIENT_RENDERING_LIBRARIES = new Set([
	"react",
	"react-dom",
	"lucide-react",
	"@base-ui/react",
	"@tanstack/react-router",
	"@tanstack/react-table",
	"class-variance-authority",
	"cn",
	"clsx",
	"tailwind-merge",
]);

function exempt(path: string, name: string): boolean {
	return (
		/(?:^|\/)(?:adapters|test-support)\//u.test(path)
		|| (name === "vitest" && testName(path)?.modifiers.includes("unit") === true)
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
	return sites.flatMap((site) => {
		const directory = packageOf(graph.packages, site.from)?.directory ?? ".";
		if (
			workspace.has(site.name)
			|| site.type
			|| site.kind !== "import"
			|| exempt(site.from, site.name)
			|| !(site.name.startsWith("node:") || runtime.get(directory)?.has(site.name))
		) {
			return [];
		}
		return [
			{
				file: site.from,
				line: site.line,
				message: `Imports outside library "${site.specifier}" as a value. Move the integration into an adapters/ folder and expose Effect values; use import type for types.`,
			},
		];
	});
});
